export interface Puzzle {
  id: string;
  created_at: string;
  date: string;
  setter_id: string;
  solver_id: string;
  target_word: string;
  secret_message: string | null;
  guesses: string[];
  is_solved: boolean;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  partner_id: string | null;
  system_notification?: string | null;
}

