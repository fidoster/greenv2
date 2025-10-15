import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { supabase } from "../lib/supabase";

interface UserAvatarProps {
  className?: string;
}

const UserAvatar = ({ className }: UserAvatarProps) => {
  const [userInitial, setUserInitial] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const getUserData = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const email = data.user.email || "";
        setUserInitial(email.charAt(0).toUpperCase());

        // Generate avatar URL using DiceBear
        const seed = email.split("@")[0] || data.user.id;
        setAvatarUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);
      }
    };

    getUserData();
  }, []);

  return (
    <Avatar className={className}>
      <AvatarImage src={avatarUrl} alt="User" />
      <AvatarFallback className="bg-[#8BA888] text-white">
        {userInitial}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
