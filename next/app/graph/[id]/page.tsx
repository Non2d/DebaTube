"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import DetailedStructure from "../../../components/DetailedStructure/DetailedStructure";

const UserPage = () => {
  const [id, setId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const currentId = window.location.pathname.split("/").pop();
    const id = parseInt(currentId || "");
    setId(id || null);
  }, []);

  if (!id) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <DetailedStructure roundId={id}/>
    </div>
  );
};

export default UserPage;