"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import GlowParticles from "@/features/home/GlowParticles";
import SectionRail from "@/features/home/SectionRail";
import { useFullpageScroll } from "@/features/home/useFullpageScroll";
import { visibleSections } from "@/features/home/sections";
import HeroSection from "@/features/home/sections/HeroSection";
import ArchiveSection from "@/features/home/sections/ArchiveSection";
import CalendarSection from "@/features/home/sections/CalendarSection";
import AssetsSection from "@/features/home/sections/AssetsSection";
import { API_CONFIGURED } from "@/features/backdoor/api";
import type { Asset, Profile, Site } from "@/lib/content";

interface FullpageDeckProps {
  profile: Profile;
  site: Site;
  heroAsset: Asset;
  archivePortraits: Asset[];
  assets: Asset[];
}

/** 整页滚动容器：SSG 首渲染即站 0、无 transform；含常驻粒子与位置指示器。 */
export default function FullpageDeck({
  profile,
  site,
  heroAsset,
  archivePortraits,
  assets,
}: FullpageDeckProps) {
  // sections 用 useMemo 稳定引用（避免每渲染新数组触发 useFullpageScroll 的 effect 重跑）
  const sections = useMemo(() => visibleSections(API_CONFIGURED), []);
  const assetsIndex = sections.findIndex((s) => s.id === "assets");
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const { index, goTo, setLocked } = useFullpageScroll({
    sections,
    assetsIndex,
    trackRef,
    containerRef,
  });

  const handleNavigate = useCallback((i: number) => goTo(i), [goTo]);

  const renderSection = (id: string) => {
    switch (id) {
      case "hero":
        return <HeroSection profile={profile} site={site} heroAsset={heroAsset} />;
      case "archive-1":
      case "archive-2":
      case "archive-3":
      case "archive-4":
      case "archive-5":
        return (
          <ArchiveSection
            part={Number(id.slice(-1))}
            profile={profile}
            portraitAssets={archivePortraits}
          />
        );
      case "calendar":
        return <CalendarSection />;
      case "assets":
        return <AssetsSection assets={assets} site={site} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* 常驻粒子层：fixed 视口，覆盖全部模块（步骤 12 已接线冲量） */}
      <GlowParticles />

      {/* 位置指示器 */}
      <SectionRail sections={sections} index={index} onNavigate={handleNavigate} />

      {/* 滚动容器（free 模式由 hook 切换 overflow） */}
      <div ref={containerRef} className="h-svh overflow-hidden">
        <div ref={trackRef} className="will-change-transform">
          {sections.map((s) => (
            <div key={s.id} data-section={s.id}>
              {renderSection(s.id)}
            </div>
          ))}
        </div>
      </div>

      {/* 隐藏用：供弹层屏蔽翻页（Lightbox/DayDetail 打开时调用） */}
      <LockController onLock={setLocked} />
    </>
  );
}

/** 监听弹层打开/关闭以屏蔽翻页输入（body overflow hidden 口径扩展）。 */
function LockController({ onLock }: { onLock: (locked: boolean) => void }) {
  const lockRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);

  const sync = useCallback(() => {
    const locked = document.body.style.overflow === "hidden";
    if (locked !== lockRef.current) {
      lockRef.current = locked;
      onLock(locked);
    }
  }, [onLock]);

  useEffect(() => {
    sync();
    observerRef.current = new MutationObserver(sync);
    observerRef.current.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => observerRef.current?.disconnect();
  }, [sync]);

  return null;
}