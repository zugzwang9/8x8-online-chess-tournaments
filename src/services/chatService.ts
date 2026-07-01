import crypto from "crypto";
import { prisma } from "../config/prisma";

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
}

const messagesByTournament = new Map<string, ChatMessage[]>();

const lastMessageAt = new Map<string, number>();
const RATE_LIMIT_MS = 5000;

export const isRateLimited = (username: string): boolean => {
  const last = lastMessageAt.get(username);
  if (last && Date.now() - last < RATE_LIMIT_MS) {
    return true;
  }
  return false;
};

const BANNED_WORDS = [
  "nigger", "nigga", "faggot", "fag", "chink", "spic", "kike", "wetback",
  "gook", "cunt", "tranny", "retard", "nazi", "beaner", "cracker",
  "dyke", "whore", "slut", "twat", "paki", "raghead", "sandnigger",
  "coon", "jigaboo", "spook", "zipperhead", "kyke", "heeb"
];

const filterMessage = (text: string): string => {
  let result = text;
  for (const word of BANNED_WORDS) {
    const pattern = new RegExp(word, "gi");
    result = result.replace(pattern, "*".repeat(word.length));
  }
  return result;
};

export const getMessages = (tournamentId: string): ChatMessage[] => {
  return messagesByTournament.get(tournamentId) || [];
};

export const initChat = async (): Promise<void> => {
  try {
    const rows = await prisma.chatMessage.findMany({
      orderBy: { createdAt: "asc" },
      take: 2000
    });
    messagesByTournament.clear();
    for (const row of rows) {
      if (!row.tournamentId) continue;
      const tId = row.tournamentId;
      if (!messagesByTournament.has(tId)) {
        messagesByTournament.set(tId, []);
      }
      messagesByTournament.get(tId)!.push({
        id: row.id,
        username: row.username,
        message: row.message,
        timestamp: row.createdAt.getTime()
      });
    }
    // Limit to 200 per tournament
    for (const [tId, msgs] of messagesByTournament.entries()) {
      if (msgs.length > 200) {
        messagesByTournament.set(tId, msgs.slice(-200));
      }
    }
    console.log(`[chat] Loaded chat from DB.`);
  } catch (err) {
    console.error("[chat] Failed to load messages from DB:", err instanceof Error ? err.message : err);
  }
};

export const addMessage = (tournamentId: string, username: string, message: string): ChatMessage | null => {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  lastMessageAt.set(username, Date.now());

  const filtered = filterMessage(trimmed);
  const newMessage: ChatMessage = {
    id: crypto.randomUUID(),
    username,
    message: filtered,
    timestamp: Date.now()
  };

  if (!messagesByTournament.has(tournamentId)) {
    messagesByTournament.set(tournamentId, []);
  }
  const msgs = messagesByTournament.get(tournamentId)!;
  msgs.push(newMessage);

  if (msgs.length > 200) {
    msgs.shift();
  }

  prisma.chatMessage.create({
    data: {
      id: newMessage.id,
      tournamentId,
      username,
      message: filtered
    }
  }).catch(err =>
    console.error("[chat] Failed to persist message to DB:", err instanceof Error ? err.message : err)
  );

  return newMessage;
};

export const clearChat = (tournamentId: string): void => {
  if (messagesByTournament.has(tournamentId)) {
    messagesByTournament.get(tournamentId)!.length = 0;
  }

  prisma.chatMessage.deleteMany({
    where: { tournamentId }
  }).catch(err =>
    console.error("[chat] Failed to clear chat in DB:", err instanceof Error ? err.message : err)
  );
};
