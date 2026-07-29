import type { ReactNode } from "react";

type AlertProps = {
  tone: "error" | "warning" | "info" | "success";
  title: string;
  children?: ReactNode;
};

export function Alert({ tone, title, children }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <strong>{title}</strong>
      {children ? <div className="alert__body">{children}</div> : null}
    </div>
  );
}
