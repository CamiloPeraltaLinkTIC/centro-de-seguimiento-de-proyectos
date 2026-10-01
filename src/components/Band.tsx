import Image from "next/image";

export default function Band({ children }: { children?: React.ReactNode }) {
  return (
    <div className="band">
      <svg className="k" viewBox="0 0 560 120" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <g fill="none" stroke="#FFFFFF" strokeWidth="1">
          <line x1="300" y1="0" x2="300" y2="120" />
          <line x1="330" y1="0" x2="330" y2="120" />
          <line x1="440" y1="0" x2="440" y2="120" />
          <line x1="330" y1="70" x2="470" y2="-20" />
          <line x1="345" y1="62" x2="490" y2="140" />
          <line x1="250" y1="120" x2="420" y2="0" />
          <line x1="380" y1="140" x2="560" y2="20" />
          <line x1="260" y1="30" x2="560" y2="30" strokeOpacity=".5" />
          <circle cx="330" cy="70" r="3" fill="#00D9FF" stroke="none" />
          <circle cx="440" cy="30" r="2.5" fill="#FFFFFF" stroke="none" />
        </g>
      </svg>
      <div className="band-in">
        <Image className="logo" src="/logo-linktic.png" alt="LinkTIC" width={135} height={64} priority />
        <span className="sep" aria-hidden="true" />
        <span className="ctx">Seguimiento de proyectos</span>
        <div className="right">{children}</div>
      </div>
    </div>
  );
}
