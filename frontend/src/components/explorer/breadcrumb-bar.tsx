"use client";

import React from "react";
import { ChevronRight, Home, Shield } from "lucide-react";
import { Breadcrumb } from "@/types";

interface BreadcrumbBarProps {
  breadcrumbs: Breadcrumb[];
  onNavigate: (id: string | null) => void;
  isVault?: boolean;
}

export function BreadcrumbBar({ breadcrumbs, onNavigate, isVault }: BreadcrumbBarProps) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-400 py-3 px-6 border-b border-slate-800/60 overflow-x-auto">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1.5 hover:text-slate-200 transition font-medium"
      >
        {isVault ? (
          <>
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">Vault Root</span>
          </>
        ) : (
          <>
            <Home className="w-3.5 h-3.5 text-slate-400" />
            <span>Home</span>
          </>
        )}
      </button>

      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        return (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <button
              onClick={() => onNavigate(crumb.id)}
              disabled={isLast}
              className={`truncate max-w-[150px] transition font-medium ${
                isLast
                  ? "text-slate-200 font-semibold cursor-default"
                  : "hover:text-slate-200"
              }`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

