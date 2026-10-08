import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { db, configured } from "../lib/supabase";
import { getMemberships, getProfile } from "../lib/api";
import type { Membership, Profile } from "../lib/types";

type Context = {
  user: User | null;
  loading: boolean;
  memberships: Membership[];
  membership: Membership | null;
  groupId: string | null;
  selectGroup: (id: string) => void;
  profile: Profile | null;
  isAdmin: boolean;
  language: "en" | "ar";
  toggleLanguage: () => void;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [groupId, setGroupId] = useState<string | null>(
    localStorage.getItem("maidan_group"),
  );
  const [language, setLanguage] = useState<"en" | "ar">(
    localStorage.getItem("maidan_lang") === "ar" ? "ar" : "en",
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.body.dir = language === "ar" ? "rtl" : "ltr";
    localStorage.setItem("maidan_lang", language);
  }, [language]);
  useEffect(() => {
    if (!configured) return;
    db()
      .auth.getUser()
      .then(({ data }) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    const {
      data: { subscription },
    } = db().auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const membershipsQuery = useQuery({
    queryKey: ["memberships", user?.id],
    queryFn: () => getMemberships(user!.id),
    enabled: !!user,
  });
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });
  const memberships = membershipsQuery.data || [];
  const membership =
    memberships.find((m) => m.group_id === groupId) || memberships[0] || null;
  useEffect(() => {
    if (membership && membership.group_id !== groupId) {
      setGroupId(membership.group_id);
      localStorage.setItem("maidan_group", membership.group_id);
    }
  }, [membership, groupId]);
  const selectGroup = (id: string) => {
    setGroupId(id);
    localStorage.setItem("maidan_group", id);
  };
  return (
    <AppContext.Provider
      value={{
        user,
        loading:
          loading || membershipsQuery.isLoading || profileQuery.isLoading,
        memberships,
        membership,
        groupId: membership?.group_id || null,
        selectGroup,
        profile: profileQuery.data || null,
        isAdmin:
          membership?.role === "group_admin" ||
          membership?.role === "super_admin",
        language,
        toggleLanguage: () => setLanguage((x) => (x === "en" ? "ar" : "en")),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("App context missing");
  return context;
}
