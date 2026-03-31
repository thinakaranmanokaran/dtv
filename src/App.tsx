import React, { useState, useEffect, useMemo } from 'react';
import { parse } from 'iptv-playlist-parser';
import { Search, Tv, Globe, Info, Play, Loader2, Filter, Radio, LayoutGrid, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VideoPlayer } from './components/VideoPlayer';
import { Channel } from './types';
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { channel } from 'diagnostics_channel';
import { addShortcut, on, clearShortcuts } from "keyboard-shortcutx";
import { LuBadgeInfo } from "react-icons/lu";

const SOURCES = [
  { name: 'Global Index', url: 'https://iptv-org.github.io/iptv/index.m3u' },
  // { name: 'News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { name: 'Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { name: 'Music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
  { name: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
];

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentSource, setCurrentSource] = useState(SOURCES[0]); // Default to Global Index to get all channels
  const [displayLimit, setDisplayLimit] = useState(200);
  const [likedChannels, setLikedChannels] = useState<Channel[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'liked'>('all');

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('likedChannels') || '[]');
    setLikedChannels(stored);

    const singleEscape = addShortcut("ctrl+c", () => {
      setSelectedChannel(null);
    });

    const doubleEscape = addShortcut("ctrl+x", () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.location.reload();
    });

    return () => {
      singleEscape();
      doubleEscape();
    }
  }, []);

  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(currentSource.url);
        // console.log("Res : ", response)
        if (!response.ok) throw new Error('Failed to fetch playlist');
        const data = await response.text();
        // console.log("Data : ", data)
        const result = parse(data);
        // console.log("result : ", result)

        const formattedChannels: Channel[] = result.items.map(item => ({
          name: item.name,
          url: item.url,
          logo: (item.tvg as any).logo || '',
          category: item.group.title || 'General',
          language: (item.tvg as any).language || 'Unknown',
          country: (item.tvg as any).country || 'Unknown'
        }));

        setChannels(formattedChannels);
        setDisplayLimit(200); // Reset limit on source change
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylist();
  }, [currentSource]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    channels.forEach(c => {
      if (c.category) {
        // Split categories like "News;Sports" into individual ones
        c.category.split(';').forEach(cat => {
          const trimmed = cat.trim();
          if (trimmed) cats.add(trimmed);
        });
      }
    });
    return ['All', ...Array.from(cats).sort()];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' ||
        (channel.category && channel.category.split(';').map(s => s.trim()).includes(selectedCategory));
      return matchesSearch && matchesCategory;
    });
  }, [channels, searchQuery, selectedCategory]);

  function handleChannelSelect(channel: Channel) {
    // console.log("Selected channel: ", channel);
    setSelectedChannel(channel);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleLike(channel: Channel) {
    let updated: Channel[] = [];

    const isAlreadyLiked = likedChannels.some(c => c.url === channel.url);

    if (isAlreadyLiked) {
      // ❌ Remove (unlike)
      updated = likedChannels.filter(c => c.url !== channel.url);
    } else {
      // ✅ Add (like)
      updated = [...likedChannels, channel];
    }

    setLikedChannels(prev => {
      let updated;

      const exists = prev.some(c => c.url === channel.url);

      if (exists) {
        updated = prev.filter(c => c.url !== channel.url);
      } else {
        updated = [...prev, channel];
      }

      localStorage.setItem('likedChannels', JSON.stringify(updated));
      return updated;
    });
  }

  function isLiked(channel: Channel) {
    return likedChannels.some(c => c.url === channel.url);
  }

  const displayChannels = viewMode === 'liked' ? likedChannels : filteredChannels;

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-black uppercase tracking-tighter mb-2">Failed to Load Playlist</h2>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-tight max-w-xs mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 animate-spin text-gray-900 mb-4" />
        <p className="font-dmsans text-xs font-bold uppercase tracking-tight text-gray-500">Loading Channels...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-gray-900 font-dmsans selection:bg-gray-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => {
          setSelectedChannel(null);
          setSearchQuery('');
          setSelectedCategory('All');
          setCurrentSource(SOURCES[0]);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          window.location.reload();
        }}>
          <div className=" rounded-2xl shadow-sm overflow-hidden w-11 h-11 flex items-center justify-center">
            <img src="/favicon.png" alt="Dtv Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">Dtv</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-1">Live Stream Viewer</p>
          </div>
        </div>

        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-100 border border-gray-200 rounded-2xl focus:outline-none focus:border-gray-900 transition-all placeholder:text-gray-400 text-sm font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          {SOURCES.map(source => (
            <button
              key={source.url}
              onClick={() => {
                setCurrentSource(source);
                setSelectedCategory('All');
                setViewMode('all'); // ✅ important
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all border ${currentSource.url === source.url
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-900 hover:text-gray-900'
                }`}
            >
              {source.name}
            </button>
          ))}
          {
            likedChannels.length > 0 && (
              <button
                onClick={() => {
                  setViewMode('liked');
                  setSelectedCategory('All');
                  setSearchQuery('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight flex items-center transition-all border ${viewMode === 'liked'
                  ? ' border-red-500'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-900 hover:text-gray-900'
                  }`}
              >
                <div className={`${viewMode === 'liked' ? "text-red-500" : "text-black"} text-sm mr-1 transition-colors duration-300`}><AiFillHeart /></div> Liked ({likedChannels.length})
              </button>
            )
          }
        </div>
      </header>

      <main className="p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-8">
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center pb-6 ">
              <div className="flex items-center gap-2  text-gray-400">
                <Filter className="w-4 h-4" />
                <h3 className="text-[10px] font-bold uppercase tracking-tight">Categories</h3>
              </div>
              <div className="text-md cursor-help" title="to close the video : Ctrl + C & to reload the app : Ctrl + X"><LuBadgeInfo /></div>
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between group cursor-pointer ${selectedCategory === cat
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <span>{cat}</span>
                  {selectedCategory !== cat && (
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200 group-hover:bg-gray-400 transition-colors" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 p-6 rounded-3xl text-white">
            <Info className="w-6 h-6 mb-4 text-gray-400" />
            <h4 className="text-sm font-bold uppercase tracking-tight mb-2">Streaming Note</h4>
            <p className="text-[11px] leading-relaxed text-gray-400 font-medium">
              Many IPTV streams are geographically restricted or require specific network conditions. If a video fails to load, it may be due to CORS restrictions or the stream being offline.
            </p>
          </div>
        </aside>

        {viewMode === 'liked' && likedChannels.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
            <Info className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-tight">
              No liked channels yet
            </p>
          </div>
        )}

        {/* Content */}
        <section className="lg:col-span-9 space-y-10">
          {/* Player Section */}
          <AnimatePresence mode="wait">
            {selectedChannel && (
              <motion.div
                key={selectedChannel.url}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <VideoPlayer
                  url={selectedChannel.url}
                  onClose={() => setSelectedChannel(null)}
                />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                  <div className="w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-tight text-gray-400">Live Now</span>
                    </div>
                    <div className="flex justify-between w-full">
                      <div className="">
                        <h2 className="text-3xl font-black uppercase tracking-tighter">{selectedChannel.name}</h2>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[10px] font-bold uppercase tracking-tight text-gray-500">{selectedChannel.category}</span>
                          <span className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[10px] font-bold uppercase tracking-tight text-gray-500 flex items-center gap-1.5">
                            <Globe className="w-3 h-3" /> {selectedChannel.country}
                          </span>
                        </div>
                      </div>
                      <div
                        className="text-4xl cursor-pointer transition-colors duration-300"
                        onClick={() => handleLike(selectedChannel)}
                      >
                        {isLiked(selectedChannel) ? (
                          <div className="text-red-500 transition-colors duration-300"><AiFillHeart /></div>
                        ) : (
                          <div className="text-black hover:text-red-400 transition-colors duration-300"><AiOutlineHeart /></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid Section */}
          <div>
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-5 h-5 text-gray-400" />
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {selectedCategory} <span className="text-gray-300">/</span> {displayChannels.length} Channel{displayChannels.length > 1 && "s"}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
              {displayChannels.slice(0, displayLimit).map((channel, idx) => (
                <motion.button
                  key={`${channel.url}-${idx}`}
                  whileHover={{ y: -6, scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    handleChannelSelect(channel);
                  }}
                  className={`group relative aspect-square bg-white border rounded-[2rem] p-6 flex flex-col items-center justify-center text-center cursor-pointer shadow-sm transition-all duration-300 ${selectedChannel?.url === channel.url
                    ? 'border-gray-900 ring-4 ring-gray-900/5'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-sky-200 transition-all duration-300'
                    }`}
                >
                  <div className="relative w-16 h-16 mb-4">
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-contain transition-all duration-500 ${selectedChannel?.url === channel.url ? 'scale-110' : 'group-hover:scale-110'
                          }`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                        <Tv className="w-6 h-6 text-gray-200 group-hover:text-gray-400 transition-all group-hover:scale-110" />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-tight leading-tight line-clamp-2 text-gray-600 group-hover:text-gray-900 transition-colors">
                    {channel.name}
                  </span>

                  {selectedChannel?.url === channel.url && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center border-4 border-[#F3F4F6]"
                    >
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>

            {displayChannels.length > displayLimit && (
              <div className="mt-16 text-center py-10">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 200)}
                  className="px-8 py-4 bg-white border border-gray-200 rounded-2xl text-xs font-bold uppercase tracking-tight hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all shadow-sm"
                >
                  Load More Channels ({displayChannels.length - displayLimit} remaining)
                </button>
              </div>
            )}

            {displayChannels.length === 0 && (
              <div className="py-32 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
                <Info className="w-10 h-10 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-tight">No channels found in this category</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="mt-20 border-t border-gray-200 p-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Tv className="w-4 h-4 text-gray-300" />
          <div className="w-8 h-[1px] bg-gray-200" />
          <Tv className="w-4 h-4 text-gray-300" />
        </div>
        <p className="text-[9px] font-bold uppercase tracking-tight text-gray-300 mb-2">
          Dtv • Open Source IPTV Viewer • 2026
        </p>
        <p className="text-[10px] font-bold uppercase tracking-tight text-gray-400">
          Author: <a href="https://thinakaran.dev/" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">Thinakaran Manokaran</a>
        </p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
      `}</style>
    </div >
  );
}
