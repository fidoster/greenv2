import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AdminPanel from "./AdminPanel";

const AdminRoute = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        // Check if user is authenticated
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          // Not logged in, redirect to home
          navigate("/");
          return;
        }

        // Check if user has admin role
        const { data: userData, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (error || !userData || userData.role !== "admin") {
          // Not an admin, redirect to home
          navigate("/");
        }
      } catch (error) {
        console.error("Error checking admin access:", error);
        navigate("/");
      }
    };

    checkAdminAccess();
  }, [navigate]);

  return <AdminPanel />;
};

export default AdminRoute;
