"use client";

import { AlertTriangle, ShieldOff, Clock, CheckCircle2, X } from "lucide-react";
import React from "react";

export type VerificationGateStatus =
  | "unverified"
  | "pending"
  | "restricted"
  | "verified";

interface VerificationBannerProps {
  status: VerificationGateStatus;
  onDismiss?: () => void;
  className?: string;
}

const BANNER_CONFIG: Record<
  Exclude<VerificationGateStatus, "verified">,
  {
    icon: React.ReactNode;
    title: string;
    message: string;
    actionLabel: string;
    actionHref: string;
    colorClass: string;
  }
> = {
  unverified: {
    icon: <ShieldOff className="h-4 w-4 shrink-0" />,
    title: "Verification required",
    message:
      "Complete identity verification to claim issues, submit reviews, or receive Wave rewards.",
    actionLabel: "Start verification",
    actionHref: "/settings#kyc",
    colorClass:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  },
  pending: {
    icon: <Clock className="h-4 w-4 shrink-0" />,
    title: "Verification in progress",
    message:
      "Your identity check is being reviewed. Some actions are limited until verification completes.",
    actionLabel: "Check status",
    actionHref: "/settings#kyc",
    colorClass:
      "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  },
  restricted: {
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
    title: "Account restricted",
    message:
      "Your account has a temporary restriction. You cannot claim new issues or submit appeals until resolved.",
    actionLabel: "Learn more",
    actionHref: "/settings#eligibility",
    colorClass:
      "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  },
};

/**
 * FE-206: Verification state banner shown across claiming, review, appeal, and reward flows.
 * Explains why an action is blocked and what to do next.
 */
export function VerificationBanner({
  status,
  onDismiss,
  className = "",
}: VerificationBannerProps) {
  if (status === "verified") return null;

  const config = BANNER_CONFIG[status];

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm ${config.colorClass} ${className}`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{config.icon}</span>
        <div className="space-y-0.5">
          <p className="font-semibold">{config.title}</p>
          <p className="text-xs opacity-90">{config.message}</p>
          <a
            href={config.actionHref}
            className="inline-block text-xs underline underline-offset-2 mt-1 hover:no-underline font-medium"
          >
            {config.actionLabel} →
          </a>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface VerificationGateProps {
  status: VerificationGateStatus;
  children: React.ReactNode;
  action?: string;
}

/**
 * FE-206: Wraps an action and blocks it with an inline message when the contributor
 * is not verified. Renders children normally when verified.
 */
export function VerificationGate({
  status,
  children,
  action = "this action",
}: VerificationGateProps) {
  if (status === "verified") {
    return <>{children}</>;
  }

  const reasonMap: Record<Exclude<VerificationGateStatus, "verified">, string> = {
    unverified: `Verification is required to perform ${action}.`,
    pending: `Your verification is pending. ${action} will be available once approved.`,
    restricted: `Your account is restricted. ${action} is currently unavailable.`,
  };

  return (
    <div className="relative" inert={true}>
      <div className="pointer-events-none opacity-40 select-none">{children}</div>
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto">
        <div className="flex items-center gap-1.5 rounded-full bg-background/90 border px-3 py-1.5 text-xs font-medium shadow-sm">
          <ShieldOff className="h-3.5 w-3.5 text-amber-500" />
          <span>{reasonMap[status]}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * FE-206: Small inline badge showing verification status.
 */
export function VerificationBadge({ status }: { status: VerificationGateStatus }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Verified
      </span>
    );
  }

  const labelMap: Record<Exclude<VerificationGateStatus, "verified">, string> = {
    unverified: "Unverified",
    pending: "Pending",
    restricted: "Restricted",
  };

  const colorMap: Record<Exclude<VerificationGateStatus, "verified">, string> = {
    unverified: "text-amber-600",
    pending: "text-blue-600",
    restricted: "text-red-600",
  };

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorMap[status]}`}>
      <ShieldOff className="h-3.5 w-3.5" />
      {labelMap[status]}
    </span>
  );
}
