import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmailSender {
  private readonly API_URL: string = 'https://api.kynsae.com';
  private readonly http = inject(HttpClient);

  public sendEmail(email: string, message: string): Observable<any> {
    return this.http.post(this.API_URL + '/emails/send', {email, message});
  }
}