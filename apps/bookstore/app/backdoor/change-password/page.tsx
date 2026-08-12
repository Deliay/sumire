import ChangePasswordCard from "@/features/backdoor/components/ChangePasswordCard";

export default function ChangePasswordPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40rem 26rem at 50% 42%, rgb(139 95 214 / 0.10), transparent 70%)",
        }}
      />
      <ChangePasswordCard standalone />
    </div>
  );
}
