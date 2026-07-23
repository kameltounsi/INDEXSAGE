import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

type Dashboard = {
  user: { name: string; department: string; jobTitle: string; username: string };
  applications: { code: string; label: string; hasAccount: boolean; url: string }[];
  metrics: { lotsProcessed: number; attendanceRate: number; attentionPoints: number; completedActions: number };
};

type Account = {
  id: number; username: string; matricule: string; fullName: string; department: string;
  jobTitle: string; workType: string; email: string; employeeStatus: string; accountStatus: string;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly http = inject(HttpClient);
  protected username = '';
  protected password = '';
  protected loading = signal(false);
  protected error = signal('');
  protected dashboard = signal<Dashboard | null>(null);
  protected accounts = signal<Account[]>([]);
  protected stats = signal({ total: 432, activationRequired: 432, active: 0 });
  protected search = signal('');
  protected isAdmin = computed(() => this.dashboard()?.user.username === 'admin');
  protected filteredAccounts = computed(() => {
    const term = this.search().trim().toLowerCase();
    return !term ? this.accounts() : this.accounts().filter((account) =>
      `${account.fullName} ${account.matricule} ${account.department}`.toLowerCase().includes(term));
  });

  protected login(): void {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    const headers = this.authHeaders();
    this.http.get<Dashboard>('/api/dashboard/me', { headers }).subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        sessionStorage.setItem('portal-auth', btoa(`${this.username}:${this.password}`));
        this.loading.set(false);
        if (this.username === 'admin') this.loadAccounts(headers);
      },
      error: () => {
        this.error.set('Identifiant incorrect ou compte non activé.');
        this.loading.set(false);
      },
    });
  }

  protected logout(): void {
    sessionStorage.removeItem('portal-auth');
    this.password = '';
    this.dashboard.set(null);
    this.accounts.set([]);
  }

  protected setSearch(value: string): void { this.search.set(value); }

  private loadAccounts(headers: HttpHeaders): void {
    this.http.get<{ content: Account[] }>('/api/accounts?size=100', { headers })
      .subscribe((page) => this.accounts.set(page.content));
    this.http.get<{ total: number; activationRequired: number; active: number }>('/api/accounts/stats', { headers })
      .subscribe((stats) => this.stats.set(stats));
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}` });
  }
}
