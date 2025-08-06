"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CircleX,
  ChevronDown,
  ChevronRight,
  Folder,
  Video,
  Gamepad2,
  Trash2,
} from "lucide-react";
import {
  deleteSeasonFolder,
  deleteGame,
  deleteVideo,
  renameVideo,
  renameSeasonFolder,
  renameGame,
} from "@/app/api/peertube/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

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
  onToggleSeason?: (seasonId: string) => void;
  onToggleGame?: (seasonId: string, gameId: string) => void;
  onDragDrop?: (
    draggedItem: { type: "season" | "game" | "video"; id: string; data: any },
    targetType: "season" | "game",
    targetId: string
  ) => void;
  onDeleteSeason?: (seasonId: string) => void;
  onDeleteGame?: (seasonId: string, gameId: string) => void;
  onDeleteVideo?: (videoId: string) => void;
  onRenameVideo?: (videoId: string, newTitle: string) => void;
  onRenameSeason?: (seasonId: string, newName: string) => void;
  onRenameGame?: (gameId: string, newName: string) => void;
}

export function LibrarySidebar({
  seasons,
  onClose,
  onToggleSeason,
  onToggleGame,
  onDragDrop,
  onDeleteSeason,
  onDeleteGame,
  onDeleteVideo,
  onRenameVideo,
  onRenameSeason,
  onRenameGame,
}: LibrarySidebarProps) {
  const { user } = useAuth();
  const [draggedItem, setDraggedItem] = useState<{
    type: "season" | "game" | "video";
    id: string;
    data: any;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [renamingItem, setRenamingItem] = useState<{
    type: "season" | "game" | "video";
    id: string;
    name: string;
  } | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    type: "season" | "game" | "video" | "multiple";
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    type: "video",
    title: "",
    description: "",
    onConfirm: async () => {},
  });

  const startRenaming = (
    type: "season" | "game" | "video",
    id: string,
    currentName: string
  ) => {
    setRenamingItem({ type, id, name: currentName });
  };

  const saveRenaming = async () => {
    if (!renamingItem || !user?._id) return;

    const { type, id, name } = renamingItem;
    if (!name.trim()) {
      setRenamingItem(null);
      return;
    }

    // Handle video renaming
    if (type === "video") {
      try {
        const response = await renameVideo(id, name.trim());
        if (response.success) {
          // Call the parent handler to update local state
          if (onRenameVideo) {
            await onRenameVideo(id, name.trim());
          }
        } else {
          console.error("Failed to rename video:", response.message);
        }
      } catch (error) {
        console.error("Error renaming video:", error);
      }
    }

    // Handle season renaming
    if (type === "season") {
      try {
        const response = await renameSeasonFolder(id, name.trim(), user._id);
        if (response.success) {
          // Call the parent handler to update local state
          if (onRenameSeason) {
            await onRenameSeason(id, name.trim());
          }
        } else {
          console.error("Failed to rename season:", response.message);
        }
      } catch (error) {
        console.error("Error renaming season:", error);
      }
    }

    // Handle game renaming
    if (type === "game") {
      try {
        const response = await renameGame(id, name.trim());
        if (response.success) {
          // Call the parent handler to update local state
          if (onRenameGame) {
            await onRenameGame(id, name.trim());
          }
        } else {
          console.error("Failed to rename game:", response.message);
        }
      } catch (error) {
        console.error("Error renaming game:", error);
      }
    }

    setRenamingItem(null);
  };

  const handleVideoSelection = (videoId: string, checked: boolean) => {
    setSelectedVideos((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(videoId);
      } else {
        newSet.delete(videoId);
      }
      return newSet;
    });
  };

  const handleSelectAllVideos = (videos: Video[], checked: boolean) => {
    setSelectedVideos((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        videos.forEach((video) => newSet.add(video._id || ""));
      } else {
        videos.forEach((video) => newSet.delete(video._id || ""));
      }
      return newSet;
    });
  };

  const showDeleteModal = (
    type: "season" | "game" | "video" | "multiple",
    title: string,
    description: string,
    onConfirm: () => Promise<void>
  ) => {
    setDeleteModal({
      open: true,
      type,
      title,
      description,
      onConfirm,
    });
  };

  const handleDeleteSeason = (seasonId: string) => {
    const season = seasons.find((s) => s.id === seasonId);
    showDeleteModal(
      "season",
      "Delete Season",
      `Are you sure you want to delete "${season?.name}"? This will also delete all games and videos within it.`,
      async () => {
        setDeletingItems((prev) => new Set(prev).add(seasonId));
        try {
          // Call the API to delete the season
          const response = await deleteSeasonFolder(seasonId);
          if (response.success) {
            // Call the parent handler to update local state
            if (onDeleteSeason) {
              await onDeleteSeason(seasonId);
            }
            toast.success("Season deleted successfully");
          } else {
            toast.error(response.message || "Failed to delete season");
          }
        } catch (error) {
          console.error("Error deleting season:", error);
          toast.error("Failed to delete season");
        } finally {
          setDeletingItems((prev) => {
            const newSet = new Set(prev);
            newSet.delete(seasonId);
            return newSet;
          });
        }
      }
    );
  };

  const handleDeleteGame = (seasonId: string, gameId: string) => {
    const season = seasons.find((s) => s.id === seasonId);
    const game = season?.games.find((g) => g.id === gameId);
    showDeleteModal(
      "game",
      "Delete Game",
      `Are you sure you want to delete "${game?.name}"? This will also delete all videos within it.`,
      async () => {
        setDeletingItems((prev) => new Set(prev).add(gameId));
        try {
          // Call the API to delete the game
          const response = await deleteGame(gameId);
          if (response.success) {
            // Call the parent handler to update local state
            if (onDeleteGame) {
              await onDeleteGame(seasonId, gameId);
            }
            toast.success("Game deleted successfully");
          } else {
            toast.error(response.message || "Failed to delete game");
          }
        } catch (error) {
          console.error("Error deleting game:", error);
          toast.error("Failed to delete game");
        } finally {
          setDeletingItems((prev) => {
            const newSet = new Set(prev);
            newSet.delete(gameId);
            return newSet;
          });
        }
      }
    );
  };

  const handleDeleteVideo = (videoId: string) => {
    const video = getAllVideosFromSeasons().find((v) => v._id === videoId);
    showDeleteModal(
      "video",
      "Delete Video",
      `Are you sure you want to delete "${
        video?.title || video?.name || "Untitled"
      }"?`,
      async () => {
        setDeletingItems((prev) => new Set(prev).add(videoId));
        try {
          // Call the API to delete the video
          const response = await deleteVideo(videoId);
          if (response.success) {
            // Call the parent handler to update local state
            if (onDeleteVideo) {
              await onDeleteVideo(videoId);
            }
            // toast.success("Video deleted successfully");
          } else {
            toast.error(response.message || "Failed to delete video");
          }
        } catch (error) {
          console.error("Error deleting video:", error);
          toast.error("Failed to delete video");
        } finally {
          setDeletingItems((prev) => {
            const newSet = new Set(prev);
            newSet.delete(videoId);
            return newSet;
          });
        }
      }
    );
  };

  const handleDeleteSelectedVideos = () => {
    if (selectedVideos.size === 0) return;

    const count = selectedVideos.size;
    showDeleteModal(
      "multiple",
      "Delete Selected Videos",
      `Are you sure you want to delete ${count} selected video${
        count > 1 ? "s" : ""
      }?`,
      async () => {
        setDeletingItems((prev) => new Set([...prev, ...selectedVideos]));
        try {
          if (onDeleteVideo) {
            const deletePromises = Array.from(selectedVideos).map(
              async (videoId) => {
                try {
                  const response = await deleteVideo(videoId);
                  if (response.success) {
                    await onDeleteVideo(videoId);
                  } else {
                    throw new Error(
                      response.message || "Failed to delete video"
                    );
                  }
                } catch (error) {
                  console.error(`Error deleting video ${videoId}:`, error);
                  throw error;
                }
              }
            );
            await Promise.all(deletePromises);
            toast.success(
              `${count} video${count > 1 ? "s" : ""} deleted successfully`
            );
          }
        } catch (error) {
          console.error("Error deleting selected videos:", error);
          toast.error("Failed to delete some videos");
        } finally {
          setDeletingItems((prev) => {
            const newSet = new Set(prev);
            selectedVideos.forEach((videoId) => newSet.delete(videoId));
            return newSet;
          });
          setSelectedVideos(new Set());
        }
      }
    );
  };

  const handleDragStart = (
    e: React.DragEvent,
    type: "season" | "game" | "video",
    id: string,
    data: any
  ) => {
    if (type === "video") {
      // If dragging a video and there are multiple selected videos, drag all selected
      if (selectedVideos.size > 1 && selectedVideos.has(id)) {
        const selectedVideoData = getAllVideosFromSeasons().filter((video) =>
          selectedVideos.has(video._id || "")
        );
        setDraggedItem({
          type: "video",
          id: "multiple",
          data: { videos: selectedVideoData, count: selectedVideos.size },
        });

        // Set drag data for visual feedback
        e.dataTransfer.setData("text/plain", `${selectedVideos.size} videos`);
      } else {
        setDraggedItem({ type, id, data });
        e.dataTransfer.setData(
          "text/plain",
          data.title || data.name || "Video"
        );
      }
    } else {
      setDraggedItem({ type, id, data });
      e.dataTransfer.setData("text/plain", data.name || "Item");
    }
    e.dataTransfer.effectAllowed = "move";
  };

  const getAllVideosFromSeasons = (): Video[] => {
    const allVideos: Video[] = [];
    seasons.forEach((season) => {
      season.games.forEach((game) => {
        allVideos.push(...game.videos);
      });
    });
    return allVideos;
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

    // Clear selected videos after successful drag and drop
    if (draggedItem.type === "video" && draggedItem.id === "multiple") {
      setSelectedVideos(new Set());
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
    <>
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
              <div className="flex items-center gap-2">
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
                      } ${
                        deletingItems.has(season.id)
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      draggable={!deletingItems.has(season.id)}
                      onDragStart={(e) =>
                        handleDragStart(e, "season", season.id, season)
                      }
                      onDragOver={(e) => handleDragOver(e, season.id)}
                      onDragLeave={(e) => setDragOverTarget(null)}
                      onDrop={(e) => handleDrop(e, "season", season.id)}
                      onClick={() =>
                        !deletingItems.has(season.id) && toggleSeason(season.id)
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gray-200">
                            <Folder className="h-4 w-4 text-black" />
                          </div>
                          {renamingItem?.type === "season" &&
                          renamingItem.id === season.id ? (
                            <Input
                              autoFocus
                              value={renamingItem.name}
                              onChange={(e) =>
                                setRenamingItem({
                                  ...renamingItem,
                                  name: e.target.value,
                                })
                              }
                              onBlur={saveRenaming}
                              onKeyDown={(e) =>
                                e.key === "Enter" && saveRenaming()
                              }
                              className="h-6 text-sm font-semibold"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className="font-semibold text-black"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (!deletingItems.has(season.id)) {
                                  startRenaming(
                                    "season",
                                    season.id,
                                    season.name
                                  );
                                }
                              }}
                            >
                              {deletingItems.has(season.id)
                                ? "Deleting..."
                                : season.name}
                            </span>
                          )}
                          {season.games.length > 0 &&
                            (season.open ? (
                              <ChevronDown className="h-4 w-4 text-black transition-transform duration-200" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-black transition-transform duration-200" />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-200 text-black px-2 py-1 rounded-full font-medium">
                            {season.games.length} games
                          </span>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSeason(season.id);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-6 w-6"
                            disabled={deletingItems.has(season.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
                              } ${
                                deletingItems.has(game.id)
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                              draggable={!deletingItems.has(game.id)}
                              onDragStart={(e) =>
                                handleDragStart(e, "game", game.id, game)
                              }
                              onDragOver={(e) => handleDragOver(e, game.id)}
                              onDragLeave={(e) => setDragOverTarget(null)}
                              onDrop={(e) => handleDrop(e, "game", game.id)}
                              onClick={() =>
                                !deletingItems.has(game.id) &&
                                toggleGame(season.id, game.id)
                              }
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 rounded-md bg-gray-200">
                                    <Gamepad2 className="h-3.5 w-3.5 text-black" />
                                  </div>
                                  {renamingItem?.type === "game" &&
                                  renamingItem.id === game.id ? (
                                    <Input
                                      autoFocus
                                      value={renamingItem.name}
                                      onChange={(e) =>
                                        setRenamingItem({
                                          ...renamingItem,
                                          name: e.target.value,
                                        })
                                      }
                                      onBlur={saveRenaming}
                                      onKeyDown={(e) =>
                                        e.key === "Enter" && saveRenaming()
                                      }
                                      className="h-6 text-sm font-medium"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <span
                                      className="font-medium text-black"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (!deletingItems.has(game.id)) {
                                          startRenaming(
                                            "game",
                                            game.id,
                                            game.name
                                          );
                                        }
                                      }}
                                    >
                                      {deletingItems.has(game.id)
                                        ? "Deleting..."
                                        : game.name}
                                    </span>
                                  )}
                                  {game.videos.length > 0 &&
                                    (game.open ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-black transition-transform duration-200" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-black transition-transform duration-200" />
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-gray-200 text-black px-2 py-1 rounded-full font-medium">
                                    {game.videos.length} videos
                                  </span>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteGame(season.id, game.id);
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-6 w-6"
                                    disabled={deletingItems.has(game.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {game.open && game.videos.length > 0 && (
                              <div className="ml-6 mt-2 space-y-1">
                                {/* Select All Videos Checkbox - Only show when no videos are selected */}
                                {selectedVideos.size === 0 && (
                                  <div className="flex items-center gap-2 p-1">
                                    <Checkbox
                                      className="border-black data-[state=checked]:bg-black data-[state=checked]:border-gray-600"
                                      checked={game.videos.every((video) =>
                                        selectedVideos.has(video._id || "")
                                      )}
                                      onCheckedChange={(checked) =>
                                        handleSelectAllVideos(
                                          game.videos,
                                          checked as boolean
                                        )
                                      }
                                      disabled={deletingItems.size > 0}
                                    />
                                    <span className="text-xs text-gray-600 font-medium">
                                      Select All ({game.videos.length})
                                    </span>
                                  </div>
                                )}

                                {/* Clear Selection - Only show when videos are selected */}
                                {selectedVideos.size > 0 &&
                                  game.videos.some((video) =>
                                    selectedVideos.has(video._id || "")
                                  ) && (
                                    <div className="flex items-center justify-between p-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-black hover:text-gray-700 hover:bg-gray-50 px-2 py-1 h-6"
                                        onClick={() => {
                                          // Clear selection for videos in this game only
                                          setSelectedVideos((prev) => {
                                            const newSet = new Set(prev);
                                            game.videos.forEach((video) => {
                                              newSet.delete(video._id || "");
                                            });
                                            return newSet;
                                          });
                                        }}
                                        disabled={deletingItems.size > 0}
                                      >
                                        Clear Selection
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 h-6"
                                        onClick={() => {
                                          // Delete all selected videos in this game
                                          const selectedVideosInGame =
                                            game.videos.filter((video) =>
                                              selectedVideos.has(
                                                video._id || ""
                                              )
                                            );
                                          if (selectedVideosInGame.length > 0) {
                                            showDeleteModal(
                                              "multiple",
                                              "Delete Selected Videos",
                                              `Are you sure you want to delete ${
                                                selectedVideosInGame.length
                                              } selected video${
                                                selectedVideosInGame.length > 1
                                                  ? "s"
                                                  : ""
                                              }?`,
                                              async () => {
                                                setDeletingItems(
                                                  (prev) =>
                                                    new Set([
                                                      ...prev,
                                                      ...selectedVideosInGame.map(
                                                        (v) => v._id || ""
                                                      ),
                                                    ])
                                                );
                                                try {
                                                  if (onDeleteVideo) {
                                                    const deletePromises =
                                                      selectedVideosInGame.map(
                                                        async (video) => {
                                                          try {
                                                            const response =
                                                              await deleteVideo(
                                                                video._id || ""
                                                              );
                                                            if (
                                                              response.success
                                                            ) {
                                                              await onDeleteVideo(
                                                                video._id || ""
                                                              );
                                                            } else {
                                                              throw new Error(
                                                                response.message ||
                                                                  "Failed to delete video"
                                                              );
                                                            }
                                                          } catch (error) {
                                                            console.error(
                                                              `Error deleting video ${video._id}:`,
                                                              error
                                                            );
                                                            throw error;
                                                          }
                                                        }
                                                      );
                                                    await Promise.all(
                                                      deletePromises
                                                    );
                                                    toast.success(
                                                      `${
                                                        selectedVideosInGame.length
                                                      } video${
                                                        selectedVideosInGame.length >
                                                        1
                                                          ? "s"
                                                          : ""
                                                      } deleted successfully`
                                                    );
                                                  }
                                                } catch (error) {
                                                  console.error(
                                                    "Error deleting selected videos:",
                                                    error
                                                  );
                                                  toast.error(
                                                    "Failed to delete some videos"
                                                  );
                                                } finally {
                                                  setDeletingItems((prev) => {
                                                    const newSet = new Set(
                                                      prev
                                                    );
                                                    selectedVideosInGame.forEach(
                                                      (video) =>
                                                        newSet.delete(
                                                          video._id || ""
                                                        )
                                                    );
                                                    return newSet;
                                                  });
                                                  // Clear selection for this game
                                                  setSelectedVideos((prev) => {
                                                    const newSet = new Set(
                                                      prev
                                                    );
                                                    game.videos.forEach(
                                                      (video) => {
                                                        newSet.delete(
                                                          video._id || ""
                                                        );
                                                      }
                                                    );
                                                    return newSet;
                                                  });
                                                }
                                              }
                                            );
                                          }
                                        }}
                                        disabled={deletingItems.size > 0}
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Delete
                                      </Button>
                                    </div>
                                  )}

                                {game.videos.map((video) => (
                                  <div
                                    key={video._id}
                                    className={`cursor-pointer p-1.5 rounded-md transition-all duration-200 border ${
                                      dragOverTarget === video._id
                                        ? "bg-[#858585] border-gray-300 shadow-md"
                                        : selectedVideos.has(video._id || "")
                                        ? "bg-[#858585] border-gray-300 shadow-md"
                                        : "bg-[#858585] border-gray-100 hover:bg-[#858585]/90 hover:border-gray-200 hover:shadow-sm"
                                    } ${
                                      draggedItem?.type === "video" &&
                                      (draggedItem?.id === video._id ||
                                        (draggedItem?.id === "multiple" &&
                                          selectedVideos.has(video._id || "")))
                                        ? "opacity-50 scale-95"
                                        : ""
                                    } ${
                                      deletingItems.has(video._id || "")
                                        ? "opacity-50 cursor-not-allowed"
                                        : ""
                                    }`}
                                    draggable={
                                      !deletingItems.has(video._id || "")
                                    }
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
                                    onDrop={(e) =>
                                      handleDrop(e, "game", game.id)
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        className="border-white data-[state=checked]:bg-black data-[state=checked]:border-gray-600"
                                        checked={selectedVideos.has(
                                          video._id || ""
                                        )}
                                        onCheckedChange={(checked) =>
                                          handleVideoSelection(
                                            video._id || "",
                                            checked as boolean
                                          )
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        disabled={deletingItems.has(
                                          video._id || ""
                                        )}
                                      />
                                      <div className="p-1 rounded bg-gray-200">
                                        <Video className="h-3 w-3 text-gray-600" />
                                      </div>
                                      {renamingItem?.type === "video" &&
                                      renamingItem.id === video._id ? (
                                        <Input
                                          autoFocus
                                          value={renamingItem.name}
                                          onChange={(e) =>
                                            setRenamingItem({
                                              ...renamingItem,
                                              name: e.target.value,
                                            })
                                          }
                                          onBlur={saveRenaming}
                                          onKeyDown={(e) =>
                                            e.key === "Enter" && saveRenaming()
                                          }
                                          className="h-5 text-xs font-medium"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : (
                                        <span
                                          className="text-xs text-black truncate font-medium"
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            if (
                                              !deletingItems.has(
                                                video._id || ""
                                              )
                                            ) {
                                              startRenaming(
                                                "video",
                                                video._id || "",
                                                video.title ||
                                                  video.name ||
                                                  "Untitled"
                                              );
                                            }
                                          }}
                                        >
                                          {deletingItems.has(video._id || "")
                                            ? "Deleting..."
                                            : video.title ||
                                              video.name ||
                                              "Untitled"}
                                        </span>
                                      )}
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteVideo(video._id || "");
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-4 w-4 ml-auto"
                                        disabled={deletingItems.has(
                                          video._id || ""
                                        )}
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </Button>
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

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              {deleteModal.title}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {deleteModal.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setDeleteModal((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setDeleteModal((prev) => ({ ...prev, open: false }));
                await deleteModal.onConfirm();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
