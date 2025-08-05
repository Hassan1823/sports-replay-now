"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  // Debug: Log the seasons data received
  console.log("LibrarySidebar - seasons received:", seasons);
  console.log("LibrarySidebar - seasons length:", seasons?.length);

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
    <div className="fixed top-0 right-0 h-full w-[70vw] md:w-[25vw] bg-white shadow-lg z-50 flex flex-col border-l border-gray-200">
      <div className="flex justify-between items-center mt-2 py-6 px-4 border-b">
        <span className="font-semibold text-lg">Library</span>
        <Button onClick={onClose} variant="ghost" size="icon">
          <CircleX className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {seasons.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No seasons found
            </div>
          ) : (
            seasons.map((season) => (
              <div key={season.id}>
                <Card
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                    dragOverTarget === season.id
                      ? "bg-blue-100 border-blue-300"
                      : ""
                  } ${
                    draggedItem?.type === "season" &&
                    draggedItem?.id === season.id
                      ? "opacity-50"
                      : ""
                  }`}
                  draggable
                  onDragStart={(e) =>
                    handleDragStart(e, "season", season.id, season)
                  }
                  onDragOver={(e) => handleDragOver(e, season.id)}
                  onDragLeave={(e) => setDragOverTarget(null)}
                  onDrop={(e) => handleDrop(e, "season", season.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-blue-500" />
                        <Button
                          variant="ghost"
                          className="h-auto p-0 text-left font-medium"
                          onClick={() => toggleSeason(season.id)}
                        >
                          {season.name}
                          {season.games.length > 0 &&
                            (season.open ? (
                              <ChevronDown className="h-4 w-4 ml-1" />
                            ) : (
                              <ChevronRight className="h-4 w-4 ml-1" />
                            ))}
                        </Button>
                      </div>
                      <span className="text-xs text-gray-500">
                        {season.games.length} games
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {season.open && season.games.length > 0 && (
                  <div className="ml-6 mt-2 space-y-2">
                    {season.games.map((game) => (
                      <div key={game.id}>
                        <Card
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                            dragOverTarget === game.id
                              ? "bg-green-100 border-green-300"
                              : ""
                          } ${
                            draggedItem?.type === "game" &&
                            draggedItem?.id === game.id
                              ? "opacity-50"
                              : ""
                          }`}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, "game", game.id, game)
                          }
                          onDragOver={(e) => handleDragOver(e, game.id)}
                          onDragLeave={(e) => setDragOverTarget(null)}
                          onDrop={(e) => handleDrop(e, "game", game.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Gamepad2 className="h-4 w-4 text-green-500" />
                                <Button
                                  variant="ghost"
                                  className="h-auto p-0 text-left font-medium"
                                  onClick={() => toggleGame(season.id, game.id)}
                                >
                                  {game.name}
                                  {game.videos.length > 0 &&
                                    (game.open ? (
                                      <ChevronDown className="h-4 w-4 ml-1" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 ml-1" />
                                    ))}
                                </Button>
                              </div>
                              <span className="text-xs text-gray-500">
                                {game.videos.length} videos
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {game.open && game.videos.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1">
                            {game.videos.map((video) => (
                              <Card
                                key={video._id}
                                className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                                  dragOverTarget === video._id
                                    ? "bg-red-100 border-red-300"
                                    : ""
                                } ${
                                  draggedItem?.type === "video" &&
                                  draggedItem?.id === video._id
                                    ? "opacity-50"
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
                                <CardContent className="p-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      className="border-gray-300"
                                      checked={selectedVideo?._id === video._id}
                                    />
                                    <Video className="h-3 w-3 text-red-500" />
                                    <span className="text-sm truncate">
                                      {video.title || video.name || "Untitled"}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
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
  );
}
