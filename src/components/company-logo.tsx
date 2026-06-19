import Image from "next/image";

export function CompanyLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      alt="Nantucket Event Co."
      className={className}
      height={102}
      priority={priority}
      src="/nantucket-event-co-logo.svg"
      width={333}
    />
  );
}
