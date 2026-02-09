
import { useState } from "react";

const ADMIN_PASSWORD = "1229";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [input, setInput] = useState("");

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 300, margin: "80px auto" }}>
        <h3>관리자 로그인</h3>
        <input
          type="password"
          placeholder="관리자 비밀번호"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button onClick={() => {
          if (input === ADMIN_PASSWORD) setIsAdmin(true);
          else alert("비밀번호가 틀렸습니다");
        }}>
          확인
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
