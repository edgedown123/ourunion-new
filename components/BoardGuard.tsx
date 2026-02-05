
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type BoardType = "ADMIN_WRITE" | "MEMBER_WRITE" | "READ_ONLY";

export default function BoardGuard({
  type,
  children,
}: {
  type: BoardType;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>로딩중...</div>;
  if (!session) return <div>로그인이 필요합니다</div>;

  if (type === "ADMIN_WRITE") {
    return <div>관리자만 작성 가능 (AdminGate로 감싸세요)</div>;
  }

  return <>{children}</>;
}
