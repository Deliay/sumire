import LoginCard from "@/features/backdoor/components/LoginCard";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-5">
      {/* 极淡应援色径向微光（静态） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40rem 26rem at 50% 42%, rgb(139 95 214 / 0.10), transparent 70%)",
        }}
      />
      <LoginCard />
    </div>
  );
}
