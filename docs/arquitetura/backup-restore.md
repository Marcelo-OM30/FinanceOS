# Backup e restauração do banco

> O FinanceOS guarda dados financeiros reais e, até 03/09/2026, **não tinha
> backup nenhum**. Este documento e o `scripts/backup-db.sh` são a correção do
> item 3 de pendências de produção.

## Contexto — por que isso virou prioridade

Em 03/09/2026 o app estava fora do ar: os três serviços do Railway (backend,
frontend e Postgres) estavam sem deploy ativo, todos os deployments marcados
como `REMOVED` desde 31/07/2026. O volume `postgres-volume` sobreviveu intacto
(112MB, status Ready) e os dados estavam lá — **por sorte, não por desenho**. Se
a remoção tivesse levado o volume junto, não haveria nada para recuperar.

## Fazer backup

```bash
./scripts/backup-db.sh            # gera o dump em ~/backups/financeos
./scripts/backup-db.sh --check    # só testa a conexão, não grava
```

Variáveis opcionais:

| Variável | Padrão | O quê |
|---|---|---|
| `FINANCEOS_BACKUP_DIR` | `~/backups/financeos` | destino |
| `FINANCEOS_BACKUP_KEEP` | `14` | quantos dumps manter |
| `DATABASE_PUBLIC_URL` | — | pula a consulta ao Railway |

O que o script faz, em ordem: descobre a URL pública no Railway, testa a
conexão, compara a versão do servidor com a do `pg_dump` local, gera o dump em
formato custom (`-Fc`), **verifica que o arquivo é legível** com `pg_restore
--list`, e rotaciona os antigos.

Três detalhes que não são óbvios e estão tratados no script:

1. **A URL interna não serve.** `DATABASE_URL` aponta para
   `postgres.railway.internal`, que só resolve dentro da rede do Railway. De
   fora é preciso a `DATABASE_PUBLIC_URL` (`*.proxy.rlwy.net`), que exige o
   proxy TCP público habilitado no serviço Postgres.
2. **`pg_dump` mais antigo que o servidor se recusa a rodar.** O servidor é
   **Postgres 18** (`ghcr.io/railwayapp-templates/postgres-ssl:18`); o cliente
   que vem no Ubuntu 24.04 é o 16, e ele **não serve**. Instale o 18:

   ```bash
   sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
   curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg
   sudo apt update && sudo apt install postgresql-client-18
   ```

   O script compara as versões antes de tentar e para com essa instrução.
3. **Arquivo criado não é backup.** Só é backup se der para ler de volta — por
   isso a verificação com `pg_restore --list`, que descarta o arquivo se ele
   não tiver nenhuma tabela com dados.

O script nunca imprime a URL de conexão: o log mostra só o host mascarado.

## Restaurar

Não existe script de restauração de propósito. Restaurar sobrescreve dados
reais; deve ser um ato deliberado, digitado à mão, não algo que se dispara sem
querer.

**Inspecionar o conteúdo de um dump** (não altera nada):

```bash
pg_restore --list ~/backups/financeos/financeos-AAAAMMDD-HHMMSS.dump
```

**Restaurar em um banco local, para testar** — é assim que se verifica de
verdade que o backup presta:

```bash
createdb financeos_teste
pg_restore --dbname=financeos_teste --no-owner --no-privileges \
  ~/backups/financeos/financeos-AAAAMMDD-HHMMSS.dump
psql financeos_teste -c '\dt'
psql financeos_teste -c 'SELECT count(*) FROM transactions;'
```

**Restaurar em produção** — só em recuperação de desastre:

```bash
# 1. pare o backend antes, para nada escrever durante a restauração
# 2. --clean --if-exists derruba os objetos existentes antes de recriar
pg_restore --dbname="$DATABASE_PUBLIC_URL" --clean --if-exists \
           --no-owner --no-privileges \
           ~/backups/financeos/financeos-AAAAMMDD-HHMMSS.dump
```

## Rotina

O script não se agenda sozinho. Duas opções, com o problema de cada uma:

- **cron no WSL:** só roda quando o WSL está aberto. Para uso pessoal em máquina
  desligada à noite, isso significa dias sem backup e sem aviso.
- **Agendador de Tarefas do Windows** chamando
  `wsl -d <distro> -- /home/marcelo/inteligenciaFinanceira/scripts/backup-db.sh`:
  roda com o Windows ligado, independente de ter terminal aberto. É a opção mais
  confiável neste ambiente.

Enquanto não houver agendamento, **rode o script à mão antes de qualquer
migration ou deploy** — que é justamente quando o risco é maior.

## Alternativa nativa

O Railway oferece *point-in-time recovery* para Postgres
(`railway postgres --help`). É melhor que dump periódico — recupera para um
instante arbitrário, não para o último dump — mas é recurso de plano pago e não
foi verificado neste projeto. Vale checar antes de investir em automatizar o
script.

**As duas coisas não se substituem.** PITR vive dentro do Railway: protege
contra erro seu (um `DELETE` sem `WHERE`), não contra perder o acesso à conta —
e a conta está no e-mail corporativo `@om30.com.br`. O dump local é a cópia que
sobrevive ao Railway.
