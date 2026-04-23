export interface ChatMessage {
  id: string;
  from: 'user' | 'bot';
  text: string;
  timestamp: Date;
  isTyping?: boolean;
  doctorRecommendations?: DoctorRecommendation[];
}

export interface DoctorRecommendation {
  name: string;
  specialty: string;
  bio: string;
  contact_email: string;
  phone?: string;
  office_address?: string;
  doctor_id: string;
  profile_link: string;
}

export interface ChatResponse {
  response: string;
  context_used: boolean;
  doctor_recommendations?: DoctorRecommendation[];
  session_id?: string;
}

export interface N8nWebhookResponseItem {
  output?: string;
  answer?: string;
}

export type N8nWebhookResponse =
  | N8nWebhookResponseItem
  | N8nWebhookResponseItem[];

export interface ChatRequest {
  query: string;
  user_id?: string;
}

export interface GroqChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    logprobs: any;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
