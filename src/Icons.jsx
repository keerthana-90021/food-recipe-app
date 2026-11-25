import React from 'react';

const paths = {
  bowl: <><path d="M2 12h20c-1 6-4.5 9-10 9s-9-3-10-9ZM8 22h8"/><g className="bowl-steam"><path d="M7 8c-2-2 2-3 1-5m4 5c-2-2 2-3 1-5m4 5c-2-2 2-3 1-5"/></g></>,
  shuffle: <><path d="M3 6h3c4 0 7 12 12 12h2m-4-3 4 3-4 3M3 18h3c2 0 3-2 4-4m4-5c1-2 3-3 4-3h2m-4-3 4 3-4 3"/></>,
  bookmark: <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m0-15a3 3 0 0 1 0 6m3 3c2 1 3 2 3 5"/></>,
  leaf: <><path d="M20 4C11 3 4 5 4 12a6 6 0 0 0 6 6c7 0 10-7 10-14ZM4 21c3-6 6-9 11-12"/></>,
  search: <><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5.5 5.5"/></>,
  filters: <><path d="M3 7h6m4 0h8M3 17h10m4 0h4"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>,
  book: <><path d="M12 6C8 3 5 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 2Zm0 0v15"/></>,
  star: <path d="m12 2.8 2.8 5.8 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2-4.5-4.4 6.3-.9Z"/>,
  share: <><path d="M12 15V3m-4 4 4-4 4 4M7 11H4v10h16V11h-3"/></>,
  check: <path d="m4 12 5 5L20 6"/>,
  back: <path d="m10 5-7 7 7 7M3 12h18"/>,
  plus: <path d="M12 4v16M4 12h16"/>,
  menu: <path d="M3 6h18M3 12h18M3 18h18"/>,
  close: <path d="m5 5 14 14M19 5 5 19"/>,
  chef: <><path d="M6 15a5 5 0 0 1-1-9 5 5 0 0 1 8-2 5 5 0 0 1 6 9v7H6Z"/><path d="M7 17h11"/></>,
};
export function Icon({name,size=18,fill=false,...props}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill={fill?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
