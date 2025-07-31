"use client";

import {
  getGamesForSeason,
  getSeasons,
  getVideoDetails,
  getVideosForGame,
  renameGame,
  renameSeasonFolder,
} from "@/app/api/peertube/api";
import Loading from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import Hls from "hls.js";
import { ChevronDown, ChevronRight, Circle, CircleCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Video = {
  description: string;
  peertubeVideoId: string;
  uploadStatus: string;
  userId: string;
  _id?: string;
  title: string;
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
  videoDuration?: string; // Added to fix compile error
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
const SeasonComponent = () => {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const shareSeasonId = searchParams.get("id");
  console.log("🚀 ~ SeasonComponent ~ shareSeasonId:", shareSeasonId);

  // useEffect(() => {
  //   if (shareSeasonId) {
  //     setSelectedSeasonId(shareSeasonId);
  //   }
  // }, [shareSeasonId]);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  type VideoDetails = {
    name?: string;
    title?: string;
    duration?: number;
    muteVideo?: boolean;
    category?: { label?: string };
    thumbnailPath?: string;
    streamingPlaylists?: { files: { fileUrl: string }[] }[];
    [key: string]: unknown; // Add more fields as needed
  };

  const [selectedVideoDetails, setSelectedVideoDetails] =
    useState<VideoDetails | null>(null);
  const [libraryVideos, setLibraryVideos] = useState<Video[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  console.log("🚀 ~ VideoPageMain ~ currentPlaybackTime:", currentPlaybackTime);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const [renamingItem, setRenamingItem] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);
  const [fetchingVideos, setFetchingVideos] = useState(false);
  const [fetchingVideoDetails, setFetchingVideoDetails] = useState(false);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  // Hls.js instance ref
  const hlsInstance = useRef<Hls | null>(null);
  const { user } = useAuth();

  // GET VIDEO DETAILS

  // Polling logic for video readiness
  const pollVideoReady = async (
    videoId: string,
    maxAttempts = 15,
    interval = 3000,
    seekTime?: number // Add optional seekTime parameter
  ) => {
    let attempts = 0;
    setFetchingVideoDetails(true);
    while (attempts < maxAttempts) {
      try {
        const res = await getVideoDetails(videoId);
        if (res.success && res.data) {
          const videoDetails = res.data as VideoDetails;
          setSelectedVideoDetails(videoDetails);
          setVideoThumbnail(
            videoDetails.thumbnailPath
              ? `${process.env.PEERTUBE_VIDEO_URL}${videoDetails.thumbnailPath}`
              : ""
          );

          if (
            videoDetails.streamingPlaylists &&
            videoDetails.streamingPlaylists.length > 0
          ) {
            setFetchingVideoDetails(false);
            // If seekTime was provided, restore playback position
            if (seekTime !== undefined && videoRef.current) {
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = seekTime;
                }
              }, 500);
            }
            return;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    setFetchingVideoDetails(false);
    toast.error("Video is still processing. Please try again later.");
  };

  // Wrapper to fetch video details, with polling if not ready
  const fetchVideoDetails = async (videoId: string) => {
    setFetchingVideoDetails(true);
    try {
      const res = await getVideoDetails(videoId);
      if (res.success && res.data) {
        const videoDetails = res.data as VideoDetails;
        setSelectedVideoDetails(videoDetails);
        setVideoThumbnail(
          videoDetails.thumbnailPath
            ? `${
                process.env.PEERTUBE_VIDEO_URL ||
                "https://video.visiononline.games"
              }${videoDetails.thumbnailPath}`
            : ""
        );
        if (
          !videoDetails.streamingPlaylists ||
          videoDetails.streamingPlaylists.length === 0
        ) {
          // Start polling if not ready
          await pollVideoReady(videoId);
        } else {
          setFetchingVideoDetails(false);
        }
      } else {
        setSelectedVideoDetails(null);
        setFetchingVideoDetails(false);
      }
    } catch (err) {
      console.log("🚀 ~ fetchVideoDetails ~ err:", err);
      setSelectedVideoDetails(null);
      setFetchingVideoDetails(false);
    }
  };

  // Load first video of first game in first season by default
  useEffect(() => {
    if (
      seasons.length > 0 &&
      !selectedSeasonId &&
      !selectedGameId &&
      !selectedVideo
    ) {
      const firstSeason = seasons[0];
      setSelectedSeasonId(firstSeason.id);

      if (firstSeason.games.length > 0) {
        const firstGame = firstSeason.games[0];
        setSelectedGameId(firstGame.id);

        if (firstGame.videos.length > 0) {
          const firstVideo = firstGame.videos[0];
          setSelectedVideo(firstVideo);
          fetchVideoDetails(firstVideo._id || "");
        }
      }
    }
  }, [seasons, selectedSeasonId, selectedGameId, selectedVideo]);

  useEffect(() => {
    if (selectedVideo && selectedVideo._id) {
      fetchVideoDetails(selectedVideo._id);
    } else {
      setSelectedVideoDetails(null);
    }
  }, [selectedVideo]);

  useEffect(() => {
    if (user?._id) {
      fetchSeasons();
    }
  }, [user]);

  const fetchSeasons = async () => {
    if (!user?._id) return;

    try {
      setLoading(true);
      const res = await getSeasons(user._id);
      if (res.success && Array.isArray(res.data)) {
        const seasonsWithGames = await Promise.all(
          res.data.map(async (season: { _id: string; name: string }) => {
            const gamesRes = await getGamesForSeason(season._id);
            const gamesWithVideos = await Promise.all(
              gamesRes.success && Array.isArray(gamesRes.data)
                ? gamesRes.data.map(
                    async (game: { _id: string; name: string }) => {
                      const videosRes = await getVideosForGame(game._id);
                      return {
                        id: game._id,
                        name: game.name,
                        videos:
                          videosRes.success && Array.isArray(videosRes.data)
                            ? videosRes.data
                            : [],
                        open: false,
                      };
                    }
                  )
                : []
            );
            return {
              id: season._id,
              name: season.name,
              open: false,
              games: gamesWithVideos,
            };
          })
        );
        setSeasons(seasonsWithGames);
      }
    } catch (err) {
      console.error("Error fetching seasons:", err);
      toast.error("Failed to load seasons");
    } finally {
      setLoading(false);
    }
  };

  const toggleSeason = (seasonId: string) => {
    setSeasons(
      seasons.map((season) =>
        season.id === seasonId ? { ...season, open: !season.open } : season
      )
    );
  };

  const startRenaming = (
    type: "season" | "game" | "video",
    id: string,
    name: string
  ) => {
    setRenamingItem({ type, id, name });
  };

  const saveRenaming = async () => {
    if (!renamingItem || !user?._id) return;

    const { type, id, name } = renamingItem;
    if (!name.trim()) {
      setRenamingItem(null);
      return;
    }

    try {
      // setSeasonLoading(true);

      if (type === "season") {
        const res = await renameSeasonFolder(id, name, user._id);
        if (res.success) {
          setSeasons(
            seasons.map((season) =>
              season.id === id ? { ...season, name } : season
            )
          );
        } else {
          toast.error(res.message || "Failed to rename season");
        }
      } else if (type === "game") {
        const res = await renameGame(id, name);
        if (res.success) {
          setSeasons(
            seasons.map((season) => ({
              ...season,
              games: season.games.map((game) =>
                game.id === id ? { ...game, name } : game
              ),
            }))
          );
        } else {
          toast.error(res.message || "Failed to rename game");
        }
      }
      setRenamingItem(null);
    } catch (err) {
      toast.error("Rename error: " + err);
    } finally {
      setSeasonLoading(false);
    }
  };

  const selectVideo = (video: Video) => {
    setSelectedVideo(video);
  };

  // FETCHING VIDEOS
  // Modified handleFetchGamesVideos - no upload restrictions
  const handleFetchGamesVideos = async (seasonId: string, gameId: string) => {
    // Clear videos first to prevent showing old videos while loading
    setLibraryVideos([]);
    setSelectedVideo(null);

    setSelectedSeasonId(seasonId);
    setSelectedGameId(gameId);

    try {
      setFetchingVideos(true);
      const res = await getVideosForGame(gameId);
      if (res.success) {
        const videos = Array.isArray(res.data) ? res.data : [];
        setLibraryVideos(videos);

        // Update only the specific game's videos in the state
        setSeasons((prevSeasons) =>
          prevSeasons.map((season) => {
            if (season.id === seasonId) {
              return {
                ...season,
                games: season.games.map((game) => {
                  if (game.id === gameId) {
                    return {
                      ...game,
                      videos: videos,
                    };
                  }
                  return game;
                }),
              };
            }
            return season;
          })
        );

        // Select the first video if available
        if (videos.length > 0) {
          setSelectedVideo(videos[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching game videos:", err);
      setLibraryVideos([]);
      setSelectedVideo(null);
    } finally {
      setFetchingVideos(false);
    }
  };

  // Call handleFetchGamesVideos on first load with first season/game
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId && !selectedGameId) {
      const firstSeason = seasons[0];
      if (firstSeason.games.length > 0) {
        const firstGame = firstSeason.games[0];
        handleFetchGamesVideos(firstSeason.id, firstGame.id);
      }
    }
  }, [seasons, selectedSeasonId, selectedGameId]);

  //* ADD NEW VIDEO
  // --------

  useEffect(() => {
    if (
      selectedVideoDetails &&
      selectedVideoDetails.streamingPlaylists &&
      selectedVideoDetails.streamingPlaylists.length > 0 &&
      videoRef.current
    ) {
      const videoSrc =
        selectedVideoDetails.streamingPlaylists[0].files[0]?.fileUrl;
      if (videoSrc && videoSrc.endsWith(".m3u8")) {
        if (Hls.isSupported()) {
          if (hlsInstance.current) {
            hlsInstance.current.destroy();
          }
          const hls = new Hls();
          hls.loadSource(videoSrc);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoRef.current?.play();
          });
          hlsInstance.current = hls;
        } else if (
          videoRef.current.canPlayType("application/vnd.apple.mpegurl")
        ) {
          videoRef.current.src = videoSrc;
        }
      } else if (videoSrc) {
        if (hlsInstance.current) {
          hlsInstance.current.destroy();
          hlsInstance.current = null;
        }
        videoRef.current.src = videoSrc;
      }
      videoRef.current.muted = selectedVideoDetails.muteVideo || false;
    } else {
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
        hlsInstance.current = null;
      }
      if (videoRef.current) {
        videoRef.current.src = "";
      }
    }
    // Cleanup on unmount
    return () => {
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
        hlsInstance.current = null;
      }
    };
  }, [selectedVideoDetails]);

  if (loading) {
    return (
      <div className="">
        <Loading fullScreen />
      </div>
    );
  }

  return (
    <>
      <div className="flex lg:flex-row flex-col justify-start items-start gap-2 lg:h-full h-auto bg-transparent">
        {/* season and game folders */}
        <div className="lg:w-1/4 lg:h-full w-full h-auto border-r py-4 px-2 bg-transparent lg:overflow-y-auto">
          <div className="space-y-4">
            {seasonLoading ? (
              <div className="w-full min-h-[40vh] h-full flex justify-center items-center">
                <Loading size={20} />
              </div>
            ) : (
              <>
                {seasons.map((season) => (
                  <Card
                    key={season.id}
                    className="px-0 py-2 my-1 border border-[#454444]"
                    style={{
                      backgroundColor: "rgb(133, 133, 133)",
                    }}
                  >
                    <CardContent className="px-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {/* // In the season selection button: */}
                          <Button
                            variant={
                              selectedSeasonId === season.id
                                ? "secondary"
                                : "ghost"
                            }
                            size="icon"
                            className={`h-6 w-6 hover:bg-transparent border-2 ${
                              selectedSeasonId === season.id
                                ? "border-[#454444] bg-black-100"
                                : "border-transparent"
                            }`}
                            onClick={() => {
                              toggleSeason(season.id);
                              setSelectedSeasonId(season.id);
                            }}
                            disabled={loading}
                          >
                            {season.open ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
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
                              className="h-8"
                              disabled={loading}
                            />
                          ) : (
                            <CardTitle
                              className="text-sm cursor-pointer"
                              onDoubleClick={() =>
                                startRenaming("season", season.id, season.name)
                              }
                              onClick={() => setSelectedSeasonId(season.id)}
                            >
                              {season.name}
                            </CardTitle>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    {/* games */}
                    {season.open && (
                      <CardContent className="p-0">
                        {season.games.map((game) => (
                          <div
                            key={game.id}
                            className="border-t border-[#454444]"
                          >
                            <div className="flex items-center justify-between p-1 hover:bg-transparent">
                              <div className="flex items-center space-x-2">
                                {/* // In the game selection button: */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 border-2 border-transparent"
                                  style={{
                                    backgroundColor:
                                      selectedGameId === game.id
                                        ? "rgb(133, 133, 133)"
                                        : "transparent",
                                  }}
                                  onClick={() => {
                                    // setLibraryVideos([]); // Clear immediately when switching
                                    // setSelectedVideo(null);
                                    handleFetchGamesVideos(season.id, game.id);
                                  }}
                                  disabled={fetchingVideos}
                                >
                                  {fetchingVideos &&
                                  selectedGameId === game.id ? (
                                    <Loading size={20} />
                                  ) : selectedGameId === game.id ? (
                                    <CircleCheck className="h-4 w-4" />
                                  ) : (
                                    <Circle className="h-4 w-4" />
                                  )}
                                </Button>
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
                                    className="h-8"
                                    disabled={loading}
                                  />
                                ) : (
                                  <span
                                    className="text-sm cursor-pointer"
                                    onDoubleClick={() =>
                                      startRenaming("game", game.id, game.name)
                                    }
                                    onClick={() =>
                                      handleFetchGamesVideos(season.id, game.id)
                                    }
                                    // onClick={() => setSelectedGameId(game.id)}
                                  >
                                    {game.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>

        {/* main container for video player */}
        <div className="flex-1 flex flex-col lg:w-flex-1 lg:h-full w-full h-auto">
          <div className="flex-1 p-4 border-b aspect-video">
            {fetchingVideoDetails ? (
              <div className="h-full flex items-center justify-center">
                <Loading />
              </div>
            ) : selectedVideo ? (
              <div className="h-full flex flex-col">
                {/* ---------trim-------------- */}

                <div className="bg-black rounded-lg aspect-video flex flex-col items-center justify-center relative">
                  {selectedVideoDetails ? (
                    <>
                      {selectedVideoDetails.streamingPlaylists &&
                      selectedVideoDetails.streamingPlaylists.length > 0 ? (
                        <>
                          <video
                            ref={videoRef}
                            controls
                            autoPlay
                            className="w-full h-full rounded-lg"
                            poster={videoThumbnail}
                            onTimeUpdate={(e) => {
                              setCurrentPlaybackTime(
                                e.currentTarget.currentTime
                              );
                            }}
                            onEnded={() => {
                              // Find the index of the current video
                              const currentIdx = libraryVideos.findIndex(
                                (v) => v._id === selectedVideo?._id
                              );
                              if (
                                currentIdx !== -1 &&
                                currentIdx < libraryVideos.length - 1
                              ) {
                                selectVideo(libraryVideos[currentIdx + 1]);
                              }
                            }}
                          />
                        </>
                      ) : fetchingVideoDetails ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                          <Loading size={24} />
                          <span className="text-white bg-black bg-opacity-50 p-2 rounded mt-2">
                            Processing video, please wait...
                          </span>
                        </div>
                      ) : (
                        <div className="relative w-full h-full">
                          {videoThumbnail && (
                            <img
                              src={videoThumbnail}
                              alt="Video Thumbnail"
                              className="w-full h-full object-contain"
                            />
                          )}
                          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
                            <span className="text-white bg-black bg-opacity-50 p-2 rounded">
                              Video not available for playback
                            </span>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                if (
                                  selectedVideo &&
                                  selectedVideo._id &&
                                  selectedSeasonId &&
                                  selectedGameId
                                ) {
                                  await handleFetchGamesVideos(
                                    selectedSeasonId,
                                    selectedGameId
                                  );
                                  fetchVideoDetails(selectedVideo._id);
                                }
                              }}
                              disabled={fetchingVideoDetails}
                            >
                              {fetchingVideoDetails ? (
                                <Loading size={20} />
                              ) : (
                                "Refetch"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <Loading size={20} />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                <div className="bg-gray-200 w-full aspect-video flex items-center justify-center rounded-lg">
                  <span className="text-gray-500">No video selected</span>
                </div>
                <div className="mt-4 text-center">
                  <h2 className="text-lg font-semibold">No Video Selected</h2>
                  <p className="text-sm text-gray-500">
                    Select a video from the library to play
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* video chapters */}
          <div className="h-auto p-4 overflow-y-auto">
            {fetchingVideos ? (
              <div className="flex items-center justify-center h-full">
                <Loading />
              </div>
            ) : (
              <>
                {libraryVideos && libraryVideos.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {libraryVideos
                        .slice(0, showAllVideos ? libraryVideos.length : 4)
                        .map((video) => {
                          return (
                            <Button
                              key={video._id}
                              variant={
                                selectedVideo?._id === video._id
                                  ? "secondary"
                                  : "outline"
                              }
                              className="flex flex-col items-center h-auto p-1"
                              onClick={() => selectVideo(video)}
                            >
                              <div className="w-full aspect-video mb-2 flex items-center justify-center rounded overflow-hidden bg-gray-200">
                                {video.videoThumbnail ? (
                                  <img
                                    src={video.videoThumbnail}
                                    alt={video.title || "Video"}
                                    className="object-cover w-full h-full"
                                  />
                                ) : (
                                  <span className="text-xs">No Thumbnail</span>
                                )}
                              </div>
                              <span className="text-sm font-medium truncate w-full text-center">
                                {video.title || "Untitled"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {video.videoDuration || "00:00"}
                              </span>
                            </Button>
                          );
                        })}
                    </div>
                    {libraryVideos.length > 4 && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="ghost"
                          onClick={() => setShowAllVideos(!showAllVideos)}
                        >
                          {showAllVideos
                            ? "Show Less"
                            : `Show More ${
                                libraryVideos.length &&
                                `(${libraryVideos.length - 4})`
                              } `}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* library section */}
        <div className="lg:w-1/4 lg:h-full w-full h-auto border-l py-4 px-2 lg:overflow-y-auto bg-transparent">
          <Card className="border px-2 bg-[#858585] gap-1">
            <h2 className="text-lg font-semibold mb-0 bg-[#858585]">
              {(() => {
                const game = seasons
                  .flatMap((season) => season.games)
                  .find((game) => game.id === selectedGameId);
                return game?.name || "Library";
              })()}
            </h2>
            {fetchingVideos ? (
              <div className="flex items-center justify-center bg-transparent">
                <Loading />
              </div>
            ) : (
              <>
                <ol className="list-none space-y-1 ">
                  {!libraryVideos || libraryVideos.length === 0 ? (
                    <>
                      <li className="w-full h-auto flex justify-center items-center">
                        No videos found
                      </li>
                    </>
                  ) : (
                    <>
                      {libraryVideos?.map((video) => (
                        <li
                          key={video._id}
                          className="px-0 text-[0.85rem] hover:bg-[#858585] rounded cursor-pointer flex justify-between items-center gap-2 "
                          onClick={() => selectVideo(video)}
                        >
                          <div className="flex justify-start items-center gap-2 w-[90%] min-h-8 text-wrap whitespace-break-spaces">
                            <Checkbox
                              className="border-[#454444] cursor-pointer"
                              checked={selectedVideo?._id === video._id}
                            />
                            <span className="truncate block">
                              {video.title || "no title"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </>
                  )}
                </ol>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
};

export default SeasonComponent;
