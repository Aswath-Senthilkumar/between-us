export interface Puzzle {
  id: string;
  created_at: string;
  date: string;
  setter_id: string;
  solver_id: string;
  target_word: string;
  hint?: string | null;
  secret_message: string | null;
  guesses: string[];
  is_solved: boolean;
  message_requested?: boolean;
  message_revealed?: boolean;
  message_viewed?: boolean;
}

export interface PartnerRequest {
  id: string;
  sender_id: string;
  receiver_email: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  partner_id: string | null;
  system_notification?: string | null;
}

