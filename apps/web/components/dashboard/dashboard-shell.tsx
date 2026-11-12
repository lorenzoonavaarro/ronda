'use client';

import { Separator } from '@repo/ui/components/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@repo/ui/components/sidebar';
import { TooltipProvider } from '@repo/ui/components/tooltip';
import { useClerk, UserButton } from '@clerk/nextjs';
import {
  ChartLineIcon,
  CirclePlusIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  Settings2Icon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';

import { clearOverviewRefresh } from '@/components/signed-in-overview-refresh';
import { apiBase } from '@/lib/http';

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboardIcon },
  { href: '/circles', label: 'Circles', icon: UsersIcon },
  { href: '/stocks', label: 'Stock', icon: ChartLineIcon },
  { href: '/portfolio', label: 'Portfolio', icon: WalletIcon },
];

export function DashboardShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 72)',
            '--header-height': 'calc(var(--spacing) * 12)',
          } as CSSProperties
        }
      >
        <Sidebar variant="inset" collapsible="offcanvas">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="data-[slot=sidebar-menu-button]:p-1.5!"
                  render={<Link href="/" />}
                >
                  <span className="text-base font-semibold">Ronda</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent className="flex flex-col gap-2">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="New circle"
                      className="bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                      render={<Link href="/circles/new" />}
                    >
                      <CirclePlusIcon />
                      <span>New circle</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
                <SidebarMenu>
                  {nav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={pathname === item.href}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <AccountMenu />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 h-4 data-vertical:self-auto"
              />
              <h1 className="text-base font-medium">{title}</h1>
            </div>
          </header>
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function AccountMenu() {
  const { signOut } = useClerk();

  async function signOutToHome() {
    clearOverviewRefresh();

    try {
      await fetch(`${apiBase()}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Clerk still has to end. Leftover API cookies expire on their own.
    }

    await signOut();
    window.location.replace('/');
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="px-1 py-1">
          <UserButton
            showName
            appearance={{
              elements: {
                rootBox: 'w-full',
                userButtonTrigger:
                  'w-full justify-start rounded-md px-2 py-1.5',
                userButtonBox: 'w-full flex-row',
              },
            }}
          >
            <UserButton.MenuItems>
              <UserButton.Link
                href="/settings"
                label="Credit & PayPal"
                labelIcon={<Settings2Icon className="size-4" />}
              />
              <UserButton.Action label="manageAccount" />
              <UserButton.Action
                label="Sign out"
                labelIcon={<LogOutIcon className="size-4" />}
                onClick={() => {
                  void signOutToHome();
                }}
              />
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
