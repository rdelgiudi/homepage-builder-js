import "./admin.css";

/** The admin panel's own chrome. The preview route is outside this group so it looks like the site. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
