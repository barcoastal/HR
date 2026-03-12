import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  gradient?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  gradient = true,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h1
          className={cn(
            "text-2xl font-bold tracking-tight md:text-3xl",
            gradient
              ? "text-gradient"
              : "text-[var(--color-text-primary)]"
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-text-muted)] max-w-xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-3 sm:mt-0">{action}</div>}
    </div>
  );
}
