import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ChatService, ChatMessage, ChatSession } from '../../services/chat.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked'; // You'll need to install this package: npm install marked

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @Input() isFullscreen: boolean = false;
  @Output() closeChat = new EventEmitter<void>();
  @Output() toggleFullscreen = new EventEmitter<void>();
  
  @ViewChild('chatMessages') chatMessagesEl: ElementRef;
  
  chatForm: FormGroup;
  loading = false;
  currentSessionId: string | null = null;
  currentMessages: ChatMessage[] = [];
  chatSessions: ChatSession[] = [];
  
  shouldScrollToBottom: boolean = true;
  
  constructor(
    private chatService: ChatService,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer
  ) {
    this.chatForm = this.fb.group({
      message: ['', [Validators.required]]
    });
  }
  
  ngOnInit(): void {
    // Subscribe to messages
    this.chatService.currentSessionMessages$.subscribe(messages => {
      this.currentMessages = messages;
      this.shouldScrollToBottom = true;
    });
    
    // Subscribe to sessions
    this.chatService.chatSessions$.subscribe(sessions => {
      this.chatSessions = sessions;
    });
    
    // Create or load a session
    this.currentSessionId = this.chatService.getActiveSessionId();
    if (!this.currentSessionId) {
      this.currentSessionId = this.chatService.createNewSession('Archaeological Analysis');
    } else {
      this.loadSession(this.currentSessionId);
    }
    
    // Add welcome message if no messages exist
    if (this.currentMessages.length === 0) {
      this.addWelcomeMessage();
    }
    
    // Load all sessions if in fullscreen mode
    if (this.isFullscreen) {
      this.loadAllSessions();
    }
  }
  
  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }
  
  onSendMessage(): void {
    if (this.chatForm.invalid) return;
    
    const message = this.chatForm.get('message')?.value;
    if (!message || message.trim() === '') return;
    
    this.loading = true;
    
    // Add a user message immediately for better UX
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      isAssistant: false,
      senderId: '',
      senderName: 'You',
      sessionId: this.currentSessionId || '',
      content: message,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.currentMessages = [...this.currentMessages, userMessage];
    this.shouldScrollToBottom = true;
    
    // Add a thinking indicator
    const thinkingMessage: ChatMessage = {
      id: `thinking-${Date.now()}`,
      isAssistant: true,
      senderId: 'system',
      senderName: 'Archaios Assistant',
      sessionId: this.currentSessionId || '',
      content: 'Thinking...',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.currentMessages = [...this.currentMessages, thinkingMessage];
    this.shouldScrollToBottom = true;
    
    // Reset the input
    this.chatForm.reset();
    
    this.chatService.sendMessage(message).subscribe({
      next: (messages) => {
        // Remove any temporary messages
        this.currentMessages = this.currentMessages.filter(
          msg => !msg.id?.startsWith('temp-') && !msg.id?.startsWith('thinking-')
        );
        
        // No need to add messages here since they're already added 
        // by the subscription to currentSessionMessages$
        this.loading = false;
        this.shouldScrollToBottom = true; // Ensure we scroll to show the new messages
      },
      error: (error) => {
        console.error('Error sending message:', error);
        // Remove the thinking indicator
        this.currentMessages = this.currentMessages.filter(msg => msg.id !== thinkingMessage.id);
        
        // Add an error message
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          isAssistant: true,
          senderId: 'system',
          senderName: 'Archaios AI',
          sessionId: this.currentSessionId || '',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.currentMessages = [...this.currentMessages, errorMessage];
        this.shouldScrollToBottom = true;
        this.loading = false;
      }
    });
  }
  
  onClearChat(): void {
    if (!this.currentSessionId) return;
    
    this.loading = true;
    this.chatService.clearChatHistory(this.currentSessionId).subscribe({
      next: () => {
        this.loading = false;
        this.addWelcomeMessage();
      },
      error: (error) => {
        console.error('Error clearing chat:', error);
        this.loading = false;
      }
    });
  }
  
  onNewChat(): void {
    this.currentSessionId = this.chatService.createNewSession('Archaeological Analysis');
    this.addWelcomeMessage();
  }
  
  onSelectSession(sessionId: string): void {
    if (this.currentSessionId === sessionId) return;
    
    this.loadSession(sessionId);
  }
  
  private loadSession(sessionId: string): void {
    this.loading = true;
    this.chatService.loadChatSession(sessionId).subscribe({
      next: () => {
        this.loading = false;
        this.currentSessionId = sessionId;
      },
      error: (error) => {
        console.error('Error loading session:', error);
        this.loading = false;
      }
    });
  }
  
  private addWelcomeMessage(): void {
    // Add welcome messages to the UI
    const welcomeMessages: ChatMessage[] = [
      {
        id: `welcome-${Date.now()}-1`,
        isAssistant: true,
        senderId: 'system',
        senderName: 'Archaios Assistant',
        sessionId: this.currentSessionId || '',
        content: 'Welcome to Archaios Analysis. I specialize in archaeological site analysis, LIDAR data interpretation, and historical context.',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: `welcome-${Date.now()}-2`,
        isAssistant: true,
        senderId: 'system',
        senderName: 'Archaios Assistant',
        sessionId: this.currentSessionId || '',
        content: 'How can I assist with your archaeological research today?',
        createdAt: new Date(Date.now() + 100), // slightly later
        updatedAt: new Date(Date.now() + 100)
      }
    ];
    
    this.currentMessages = welcomeMessages;
  }
  
  private scrollToBottom(): void {
    try {
      this.chatMessagesEl.nativeElement.scrollTop = 
        this.chatMessagesEl.nativeElement.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }
  
  // Format chat timestamps for display
  formatTimestamp(date?: Date): string {
    if (!date) return '';
    
    const now = new Date();
    const messageDate = new Date(date);
    
    // If same day, show time only
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise show date and time
    return messageDate.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric'
    }) + ' ' + messageDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // Add a method to handle the fullscreen toggle button click
  onToggleFullscreen(): void {
    // If we're going to fullscreen mode, load the sessions
    if (!this.isFullscreen) {
      this.loadAllSessions();
    }
    
    // Emit the event without parameters
    this.toggleFullscreen.emit();
  }
  
  // Convert markdown to HTML
  parseMarkdown(content: string): SafeHtml {
    try {

      const htmlContent = marked.parse(content) as string;
      return htmlContent;
    } catch (e) {
      console.error('Error parsing markdown:', e);
      return this.sanitizer.bypassSecurityTrustHtml(content);
    }
  }
  
  // Add this method to load sessions
  private loadAllSessions(): void {
    this.loading = true;
    this.chatService.loadChatSessions().subscribe({
      next: () => {
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sessions:', error);
        this.loading = false;
      }
    });
  }
}