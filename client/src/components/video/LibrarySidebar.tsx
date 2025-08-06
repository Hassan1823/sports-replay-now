"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CircleX,
  ChevronDown,
  ChevronRight,
  Folder,
  Video,
  Gamepad2,
} from "lucide-react";

type Video = {
  _id?: string;
  title: string;
  description: string;
  peertubeVideoId: string;
  uploadStatus: string;
  userId: string;
  tags: string[];
  category: number;
  license: number;
  privacy: number;
  peertubeChannelId: number;
  thumbnailPath?: string;
  videoShareLink?: string;
  videoChannel?: string;
  duration?: number;
  name?: string;
  videoThumbnail?: string;
  videoDuration?: string;
};

type Game = {
  id: string;
  name: string;
  videos: Video[];
  open: boolean;
  selected?: boolean;
};

type Season = {
  id: string;
  name: string;
  games: Game[];
  open: boolean;
};

interface LibrarySidebarProps {
  seasons: Season[];
  onClose: () => void;
  onSelectVideo: (video: Video) => void;
  selectedVideo?: Video | null;
  onToggleSeason?: (seasonId: string) => void;
  onToggleGame?: (seasonId: string, gameId: string) => void;
  onDragDrop?: (
    draggedItem: { type: "season" | "game" | "video"; id: string; data: any },
    targetType: "season" | "game",
    targetId: string
  ) => void;
}

export function LibrarySidebar({
  seasons,
  onClose,
  onSelectVideo,
  selectedVideo,
  onToggleSeason,
  onToggleGame,
  onDragDrop,
}: LibrarySidebarProps) {
  const [draggedItem, setDraggedItem] = useState<{
    type: "season" | "game" | "video";
    id: string;
    data: any;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const handleDragStart = (
    e: React.DragEvent,
    type: "season" | "game" | "video",
    id: string,
    data: any
  ) => {
    setDraggedItem({ type, id, data });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (targetId) {
      setDragOverTarget(targetId);
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    targetType: "season" | "game",
    targetId: string
  ) => {
    e.preventDefault();

    if (!draggedItem) return;

    // Call the parent's drag drop handler
    if (onDragDrop) {
      onDragDrop(draggedItem, targetType, targetId);
    }

    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const toggleSeason = (seasonId: string) => {
    if (onToggleSeason) {
      onToggleSeason(seasonId);
    }
  };

  const toggleGame = (seasonId: string, gameId: string) => {
    if (onToggleGame) {
      onToggleGame(seasonId, gameId);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />

      {/* Sidebar */}
      <div className="absolute right-0 top-0 h-full w-[25%] shadow-2xl flex flex-col bg-white">
        {/* Header */}
        <div className="bg-white p-4 border-b border-gray-300 mb-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-black text-lg flex items-center gap-2">
              <Folder className="h-5 w-5 text-black" />
              Library
            </span>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-white hover:text-white bg-black hover:bg-black/90 rounded-md transition-all duration-200"
            >
              <CircleX className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 bg-white">
          <div className="space-y-1">
            {seasons.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Folder className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium">No seasons found</p>
                <p className="text-sm text-gray-400 mt-2">
                  Start by creating your first season
                </p>
              </div>
            ) : (
              seasons.map((season) => (
                <div key={season.id}>
                  <div
                    className={`cursor-pointer p-2 rounded-xl transition-all duration-200 border ${
                      dragOverTarget === season.id
                        ? "bg-[#858585] border-gray-300 shadow-lg"
                        : "bg-[#858585] border-gray-200 hover:bg-[#858585]/90 hover:border-gray-300 hover:shadow-md"
                    } ${
                      draggedItem?.type === "season" &&
                      draggedItem?.id === season.id
                        ? "opacity-50 scale-95"
                        : ""
                    }`}
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(e, "season", season.id, season)
                    }
                    onDragOver={(e) => handleDragOver(e, season.id)}
                    onDragLeave={(e) => setDragOverTarget(null)}
                    onDrop={(e) => handleDrop(e, "season", season.id)}
                    onClick={() => toggleSeason(season.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-200">
                          <Folder className="h-4 w-4 text-black" />
                        </div>
                        <span className="font-semibold text-black">
                          {season.name}
                        </span>
                        {season.games.length > 0 &&
                          (season.open ? (
                            <ChevronDown className="h-4 w-4 text-black transition-transform duration-200" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-black transition-transform duration-200" />
                          ))}
                      </div>
                      <span className="text-xs bg-gray-200 text-black px-2 py-1 rounded-full font-medium">
                        {season.games.length} games
                      </span>
                    </div>
                  </div>

                  {season.open && season.games.length > 0 && (
                    <div className="ml-6 mt-3 space-y-2">
                      {season.games.map((game) => (
                        <div key={game.id}>
                          <div
                            className={`cursor-pointer p-2 rounded-lg transition-all duration-200 border ${
                              dragOverTarget === game.id
                                ? "bg-[#858585] border-gray-300 shadow-lg"
                                : "bg-[#858585] border-gray-200 hover:bg-[#858585]/90 hover:border-gray-300 hover:shadow-md"
                            } ${
                              draggedItem?.type === "game" &&
                              draggedItem?.id === game.id
                                ? "opacity-50 scale-95"
                                : ""
                            }`}
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, "game", game.id, game)
                            }
                            onDragOver={(e) => handleDragOver(e, game.id)}
                            onDragLeave={(e) => setDragOverTarget(null)}
                            onDrop={(e) => handleDrop(e, "game", game.id)}
                            onClick={() => toggleGame(season.id, game.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-md bg-gray-200">
                                  <Gamepad2 className="h-3.5 w-3.5 text-black" />
                                </div>
                                <span className="font-medium text-black">
                                  {game.name}
                                </span>
                                {game.videos.length > 0 &&
                                  (game.open ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-black transition-transform duration-200" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-black transition-transform duration-200" />
                                  ))}
                              </div>
                              <span className="text-xs bg-gray-200 text-black px-2 py-1 rounded-full font-medium">
                                {game.videos.length} videos
                              </span>
                            </div>
                          </div>

                          {game.open && game.videos.length > 0 && (
                            <div className="ml-6 mt-2 space-y-1">
                              {game.videos.map((video) => (
                                <div
                                  key={video._id}
                                  className={`cursor-pointer p-1.5 rounded-md transition-all duration-200 border ${
                                    dragOverTarget === video._id
                                      ? "bg-[#858585] border-gray-300 shadow-md"
                                      : "bg-[#858585] border-gray-100 hover:bg-[#858585]/90 hover:border-gray-200 hover:shadow-sm"
                                  } ${
                                    draggedItem?.type === "video" &&
                                    draggedItem?.id === video._id
                                      ? "opacity-50 scale-95"
                                      : ""
                                  }`}
                                  draggable
                                  onDragStart={(e) =>
                                    handleDragStart(
                                      e,
                                      "video",
                                      video._id || "",
                                      video
                                    )
                                  }
                                  onDragOver={(e) =>
                                    handleDragOver(e, video._id || "")
                                  }
                                  onDragLeave={(e) => setDragOverTarget(null)}
                                  onDrop={(e) => handleDrop(e, "game", game.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      className="border-white data-[state=checked]:bg-black data-[state=checked]:border-gray-600"
                                      checked={selectedVideo?._id === video._id}
                                    />
                                    <div className="p-1 rounded bg-gray-200">
                                      <Video className="h-3 w-3 text-gray-600" />
                                    </div>
                                    <span className="text-xs text-black truncate font-medium">
                                      {video.title || video.name || "Untitled"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
