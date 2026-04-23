import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  noPadding?: boolean;
}

export default function Card({
  children,
  header,
  noPadding,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-sm border border-gray-100',
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-800">
          {header}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
}
