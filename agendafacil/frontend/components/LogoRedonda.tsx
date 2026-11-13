/** Logo sempre redonda: a imagem é cortada ao centro (object-fit: cover), sem distorcer. */
export default function LogoRedonda({ src, className = '' }: { src: string; className?: string }) {
  return (
    <span className={`logo-redonda ${className}`.trim()}>
      <img src={src} alt="" onError={(e) => { const p = e.currentTarget.parentElement; if (p) p.style.display = 'none'; }} />
    </span>
  );
}
