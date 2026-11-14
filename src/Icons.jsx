import React from 'react';
import RoomArtwork, { ProceduralRoomArtwork } from './RoomArtwork';
import {
  Home, Calendar, Search, Repeat, CircleQuestion, BookOpen, Logout,
  DragAndDrop, Expand, Plus, Minus, Close, Check, ArrowRight,
  ChevronRight, ChevronDown, Pencil, Trash, Coffee, Shirt, Box,
  Sparkles, Sofa, Bed, Clock, CircleInfo, Bell, Move, Users, User,
  Map, Clipboard, Package, BottleWine, Eye, Star,
} from 'pixelarticons/react';

const icons = {
  home: Home, calendar: Calendar, search: Search, repeat: Repeat,
  question: CircleQuestion, book: BookOpen, away: Logout,
  drag: DragAndDrop, expand: Expand, plus: Plus, minus: Minus,
  close: Close, check: Check, arrow: ArrowRight, chevron: ChevronRight,
  down: ChevronDown, edit: Pencil, trash: Trash, dishes: Coffee,
  laundry: Shirt, supplies: Package, sparkles: Sparkles, kitchen: Coffee,
  sofa: Sofa, bed: Bed, bath: Box, clock: Clock, info: CircleInfo,
  bell: Bell, grip: Move, move: Move, people: Users, user: User, map: Map,
  requests: Clipboard, roll: Package, bottle: BottleWine, hallway: Map, eye: Eye, star: Star,
};

export const ICON_NAMES = Object.keys(icons);

export default function Icon({ name, size = 20, ...props }) {
  const PixelIcon = icons[name] || Home;
  return <PixelIcon width={size} height={size} aria-hidden="true" className="pixel-icon" {...props}/>;
}

export function Furniture({ type }) {
  if (['hallway', 'custom', 'laundry'].includes(type)) return <ProceduralRoomArtwork type={type}/>;
  const artwork = { kitchen: 'kitchen', living: 'living', bedroom: 'bedroom', bathroom: 'bathroom' }[type] || 'living';
  return <RoomArtwork artwork={artwork} type={type}/>;
}
