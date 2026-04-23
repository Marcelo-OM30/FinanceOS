import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Or } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  /**
   * Retorna categorias do sistema (userId null) + categorias customizadas do usuário.
   */
  async findAll(userId: string): Promise<Category[]> {
    return this.categoriesRepository.find({
      where: [{ userId: IsNull() }, { userId }],
      order: { tipo: 'ASC', nome: 'ASC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: [{ id, userId: IsNull() }, { id, userId }],
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    return category;
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoriesRepository.findOne({
      where: { userId, nome: dto.nome },
    });

    if (existing) {
      throw new ConflictException('Já existe uma categoria com este nome');
    }

    if (dto.categoriaPaiId) {
      await this.findOne(dto.categoriaPaiId, userId);
    }

    const category = this.categoriesRepository.create({
      ...dto,
      userId,
      customizada: true,
    });

    return this.categoriesRepository.save(category);
  }

  async update(id: string, userId: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    if (!category.customizada) {
      throw new ForbiddenException('Categorias do sistema não podem ser editadas');
    }

    if (dto.nome && dto.nome !== category.nome) {
      const existing = await this.categoriesRepository.findOne({
        where: { userId, nome: dto.nome },
      });
      if (existing) {
        throw new ConflictException('Já existe uma categoria com este nome');
      }
    }

    if (dto.categoriaPaiId) {
      await this.findOne(dto.categoriaPaiId, userId);
    }

    Object.assign(category, dto);
    return this.categoriesRepository.save(category);
  }

  async remove(id: string, userId: string): Promise<void> {
    const category = await this.categoriesRepository.findOne({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    if (!category.customizada) {
      throw new ForbiddenException('Categorias do sistema não podem ser excluídas');
    }

    await this.categoriesRepository.remove(category);
  }
}
