import Image from "next/image";
import Link from "next/link";

/**
 * Cityline's marks in Payload's own screens: the login page logo, the nav
 * icon, and a way back to the operations screens from Payload's record views.
 */

export function AdminLogo() {
  return (
    <Image
      src="/brand/cityline-logo.svg"
      alt="Cityline Airport Transfers"
      width={708}
      height={531}
      priority
      style={{ height: 72, width: "auto" }}
    />
  );
}

export function AdminIcon() {
  return (
    <Image
      src="/brand/cityline-logo.svg"
      alt="Cityline"
      width={708}
      height={531}
      style={{ height: 28, width: "auto" }}
    />
  );
}

export function BackToOperations() {
  return (
    <Link
      href="/admin/dashboard"
      style={{
        display: "block",
        margin: "0 0 16px",
        padding: "8px 12px",
        borderRadius: 6,
        background: "#eef4ff",
        color: "#1d4ed8",
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      ← Operations
    </Link>
  );
}
