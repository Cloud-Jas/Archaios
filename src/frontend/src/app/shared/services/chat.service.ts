import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id?: string;
  isAssistant: boolean;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  sessionId: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
  agentMessages?: AgentChatMessage[];
}

export interface AgentChatMessage {
  agentId: string;
  agentName: string;
  message: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  name: string;
  lastMessage: string;
  lastUpdated: Date;
  messageCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly apiUrl = `${environment.backendApi}/chat`;
  private chatSessions = new BehaviorSubject<ChatSession[]>([]);
  private currentSessionMessages = new BehaviorSubject<ChatMessage[]>([]);
  
  chatSessions$ = this.chatSessions.asObservable();
  currentSessionMessages$ = this.currentSessionMessages.asObservable();
  
  private activeChatSessionId: string | null = null;
  
  constructor(private http: HttpClient) {}
  
  createNewSession(name: string = 'New Chat'): string {
    const sessionId = this.generateSessionId();
    const newSession: ChatSession = {
      id: sessionId,
      name: name,
      lastMessage: 'Start a new conversation',
      lastUpdated: new Date(),
      messageCount: 0
    };
    
    const currentSessions = this.chatSessions.value;
    this.chatSessions.next([...currentSessions, newSession]);
    
    this.activeChatSessionId = sessionId;
    this.currentSessionMessages.next([]);
    
    return sessionId;
  }
  
  loadChatSession(sessionId: string): Observable<ChatMessage[]> {
    this.activeChatSessionId = sessionId;
    
    return this.http.get<{success: boolean, messages: ChatMessage[], count: number}>(`${this.apiUrl}/sessions/${sessionId}`)
      .pipe(
        tap(response => {
          if (response.success && response.messages) {
            console.log('Loaded messages for session:', sessionId, response.messages);
            const messages = response.messages.map(msg => ({
              ...msg,
              createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
              updatedAt: msg.updatedAt ? new Date(msg.updatedAt) : undefined
            }));
            
            this.currentSessionMessages.next(messages);
            
            if (messages.length > 0) {
              this.updateSessionInfo(sessionId, messages);
            }
          } else {
            this.currentSessionMessages.next([]);
          }
        }),
        catchError(error => {
          console.error('Error loading chat session:', error);
          this.currentSessionMessages.next([]);
          throw error;
        }),

        map(response => response.success && response.messages ? response.messages.map(msg => ({
          ...msg,
          createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
          updatedAt: msg.updatedAt ? new Date(msg.updatedAt) : undefined
        })) : [])
      );
  }
  
  sendMessage(content: string): Observable<ChatMessage[]> {
    if (!this.activeChatSessionId) {
      this.activeChatSessionId = this.createNewSession();
    }
    
    const requestData = {
      userQuery: content,
      chatMessages: [] 
    };
    
    const headers = new HttpHeaders().set('Session-Id', this.activeChatSessionId);
    
    return this.http.post<{success: boolean, messages: ChatMessage[], sessionId: string}>(`${this.apiUrl}`, requestData, { headers })
      .pipe(
        map(response => {
          if (response.success && response.messages) {
            const messages = response.messages.map(msg => ({
              ...msg,
              createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
              updatedAt: msg.updatedAt ? new Date(msg.updatedAt) : undefined
            }));
            
            const currentMessages = this.currentSessionMessages.value;
            const updatedMessages = [...currentMessages, ...messages];
            this.currentSessionMessages.next(updatedMessages);
            
            if (messages.length > 0) {
              this.updateSessionInfo(this.activeChatSessionId!, updatedMessages);
            }
            
            return messages;
          }
          return [];
        }),
        catchError(error => {
          console.error('Error sending message:', error);
          throw error;
        })
      );
  }
  
  clearChatHistory(sessionId: string): Observable<any> {
    return this.http.delete<{success: boolean, message: string}>(`${this.apiUrl}/${sessionId}`)
      .pipe(
        tap(response => {
          if (response.success) {
            if (sessionId === this.activeChatSessionId) {
              this.currentSessionMessages.next([]);
            }
            
            this.updateSessionMetadata(sessionId, {
              lastMessage: 'Chat history cleared',
              messageCount: 0,
              lastUpdated: new Date()
            });
          }
        }),
        catchError(error => {
          console.error('Error clearing chat history:', error);
          throw error;
        })
      );
  }
  
  loadChatSessions(): Observable<ChatSession[]> {
    return this.http.get<{success: boolean, sessions: ChatSession[], count: number}>(`${this.apiUrl}/sessions`)
      .pipe(
        tap(response => {
          if (response.success && response.sessions) {
            console.log('Loaded chat sessions:', response.sessions.length);
            const sessions = response.sessions.map(session => ({
              ...session,
              lastUpdated: session.lastUpdated ? new Date(session.lastUpdated) : new Date()
            }));
            
            this.chatSessions.next(sessions);
          } else {
            this.chatSessions.next([]);
          }
        }),
        catchError(error => {
          console.error('Error loading chat sessions:', error);
          this.chatSessions.next([]);
          throw error;
        }),
        map(response => response.success && response.sessions ? response.sessions.map(session => ({
          ...session,
          lastUpdated: session.lastUpdated ? new Date(session.lastUpdated) : new Date()
        })) : [])
      );
  }
  
  getActiveSessionId(): string | null {
    return this.activeChatSessionId;
  }
  
  setActiveSession(sessionId: string): void {
    this.activeChatSessionId = sessionId;
  }
  
  private generateSessionId(): string {
    return `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
  
  private updateSessionInfo(sessionId: string, messages: ChatMessage[]): void {
    if (messages.length === 0) return;
    
    const sortedMessages = [...messages].sort((a, b) => 
      (b.createdAt?.getTime() || Date.now()) - (a.createdAt?.getTime() || Date.now())
    );
    
    const latestMessage = sortedMessages[0];
    
    this.updateSessionMetadata(sessionId, {
      lastMessage: latestMessage.content.substring(0, 30) + (latestMessage.content.length > 30 ? '...' : ''),
      lastUpdated: latestMessage.createdAt || new Date(),
      messageCount: this.currentSessionMessages.value.length
    });
  }
  
  private updateSessionMetadata(sessionId: string, updates: Partial<ChatSession>): void {
    const sessions = this.chatSessions.value;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex >= 0) {
      const updatedSession = {
        ...sessions[sessionIndex],
        ...updates
      };
      
      const updatedSessions = [
        ...sessions.slice(0, sessionIndex),
        updatedSession,
        ...sessions.slice(sessionIndex + 1)
      ];
      
      updatedSessions.sort((a, b) => 
        b.lastUpdated.getTime() - a.lastUpdated.getTime()
      );
      
      this.chatSessions.next(updatedSessions);
    }
  }
}
