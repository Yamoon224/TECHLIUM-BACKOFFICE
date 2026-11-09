import Image from "next/image";

export function LogoMark() {
  return (
    <span className="flex items-center gap-2">
      <Image src="/icon-192.png" alt="" width={32} height={32} priority className="h-8 w-8" />
      <span className="gold-text font-display text-2xl font-semibold tracking-tight">
<<<<<<< HEAD
        TechLium
=======
        TechniLium
>>>>>>> 0376d01425630b79cfcc80c036cb7a4206e89841
      </span>
    </span>
  );
}
