import "@supabase/supabase-js";

declare module "@supabase/supabase-js" {
  interface User {
    name?: string;
  }
}
