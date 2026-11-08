import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";
import { buildApiUrl, normalizeApiBaseUrl, resolveFetchBaseUrl } from "../api";
import type { ApiHealth } from "../types/common";
import type { AreaView } from "../domain/types";

@Injectable({ providedIn: "root" })
export class SomApiService {
  constructor(private readonly http: HttpClient) {}

  async checkHealth(apiBaseUrl: string, useDevProxy: boolean): Promise<ApiHealth> {
    const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
    const fetchBaseUrl = resolveFetchBaseUrl(baseUrl, useDevProxy);

    try {
      await firstValueFrom(this.http.get(`${fetchBaseUrl}/api/v1/game`).pipe(timeout(2500)));

      return {
        state: "online",
        detail: useDevProxy ? `Connected through local proxy to ${baseUrl}` : `Connected to ${baseUrl}`,
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status > 0) {
        return {
          state: "offline",
          detail: `Backend answered with HTTP ${error.status}`,
        };
      }

      return {
        state: "offline",
        detail: useDevProxy ? `Local proxy cannot reach ${baseUrl}` : `Browser cannot reach ${baseUrl}`,
      };
    }
  }

  async getAreas(apiBaseUrl: string, useDevProxy: boolean): Promise<AreaView[]> {
    return this.list<AreaView>(apiBaseUrl, useDevProxy, "/api/v1/areas");
  }

  async list<T>(apiBaseUrl: string, useDevProxy: boolean, endpoint: string): Promise<T[]> {
    const payload = await firstValueFrom(this.http.get<unknown>(this.apiUrl(apiBaseUrl, useDevProxy, endpoint)));

    if (!Array.isArray(payload)) {
      throw new Error("Expected API response to be a JSON array.");
    }

    return payload as T[];
  }

  async save<T>(
    apiBaseUrl: string,
    useDevProxy: boolean,
    endpoint: string,
    payload: unknown,
    isExistingDocument: boolean,
  ): Promise<T> {
    const request = isExistingDocument
      ? this.http.put<T>(this.apiUrl(apiBaseUrl, useDevProxy, endpoint), payload)
      : this.http.post<T>(this.apiUrl(apiBaseUrl, useDevProxy, endpoint), payload);

    return firstValueFrom(request);
  }

  private apiUrl(apiBaseUrl: string, useDevProxy: boolean, endpoint: string): string {
    return buildApiUrl(apiBaseUrl, useDevProxy, endpoint);
  }
}
