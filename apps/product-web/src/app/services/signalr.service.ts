import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection: signalR.HubConnection | null = null;
  public connectionStatus = signal<'Connected' | 'Disconnected' | 'Connecting' | 'Error'>('Disconnected');
  
  // Example for real-time messages
  public notifications = signal<any[]>([]);

  constructor() {
    // Note: In a real app, you might want to wait for auth before starting
  }

  public startConnection(): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.connectionStatus.set('Connecting');

    // Use environment endpoint or a dedicated hub URL
    const hubUrl = `${environment.apiEndpoint}/notificationHub`; 

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log('🚀 SignalR Connection Started');
        this.connectionStatus.set('Connected');
        this.registerHandlers();
      })
      .catch(err => {
        console.error('❌ Error while starting SignalR connection: ' + err);
        this.connectionStatus.set('Error');
        // Retry logic is handled by withAutomaticReconnect()
      });
  }

  private registerHandlers(): void {
    if (!this.hubConnection) return;

    // Example: Listen for "ReceiveNotification" from .NET Hub
    this.hubConnection.on('ReceiveNotification', (data: any) => {
      console.log('🔔 New Notification:', data);
      this.notifications.update(prev => [data, ...prev]);
    });

    // Example: Listen for cycle update events
    this.hubConnection.on('UpdateCycleData', (data: any) => {
      console.log('🔄 Cycle data updated via SignalR:', data);
      // Logic to trigger UI refresh or update state
    });
  }

  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop()
        .then(() => {
          this.connectionStatus.set('Disconnected');
          console.log('🔌 SignalR Connection Stopped');
        });
    }
  }

  /**
   * Invoke a method on the server hub
   */
  public async sendMessage(methodName: string, ...args: any[]): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return this.hubConnection.invoke(methodName, ...args);
    } else {
      console.warn('⚠️ Cannot send message: SignalR not connected');
    }
  }
}
