import { useState } from 'react';
import { MoveUpRight } from 'lucide-react';

export default function WingLab() {
  const [angle, setAngle] = useState(5);
  return (
    <div className="wing-lab">
      <div className="lab-top">
        <span>
          <i /> WIND TUNNEL / 01
        </span>
        <span>
          机翼观察室 <MoveUpRight size={14} />
        </span>
      </div>
      <svg
        viewBox="0 0 540 270"
        role="img"
        aria-label={`迎角 ${angle} 度的机翼剖面示意图，流线仅作视觉说明`}
      >
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M30 0H0V30" fill="none" stroke="#526653" strokeOpacity=".10" />
          </pattern>
          <linearGradient id="wing" x2="0" y2="1">
            <stop stopColor="#edf3dd" />
            <stop offset="1" stopColor="#9bac8b" />
          </linearGradient>
        </defs>
        <rect width="540" height="270" fill="url(#grid)" />
        {[65, 90, 115, 165, 190, 215].map((y, i) => (
          <path
            key={y}
            className="streamline"
            style={{ animationDelay: `${i * -0.6}s` }}
            d={`M-10 ${y} C125 ${y}, 135 ${y + (y < 140 ? -20 : 20)}, 205 ${y + (y < 140 ? -30 : 12)} S350 ${y}, 550 ${y}`}
            fill="none"
            stroke="#819776"
            strokeWidth="1.2"
            strokeDasharray="70 12"
          />
        ))}
        <path d="M90 145H450" stroke="#536949" strokeOpacity=".25" strokeDasharray="3 6" />
        <g transform={`rotate(${-angle} 270 140)`}>
          <path
            d="M130 145C120 116 214 96 285 115L420 145C301 140 205 158 143 153Q127 152 130 145Z"
            fill="url(#wing)"
            stroke="#3d5740"
            strokeWidth="1.5"
          />
          <path
            d="M136 141C215 125 310 134 420 145"
            fill="none"
            stroke="#617c51"
            strokeDasharray="3 4"
          />
        </g>
        <path d="M278 83V35m-7 9 7-9 7 9" fill="none" stroke="#2c4938" strokeWidth="1.5" />
        <text x="291" y="53" fontSize="11" fill="#3d5740">
          LIFT / 升力
        </text>
        <text x="26" y="148" fontSize="10" fill="#678060">
          气流 →
        </text>
        <text x="382" y="247" fontSize="10" fill="#678060">
          AIRFOIL SECTION
        </text>
      </svg>
      <div className="lab-control">
        <label htmlFor="angle">
          试着改变迎角 <span>{angle}°</span>
        </label>
        <input
          id="angle"
          aria-label="迎角"
          type="range"
          min="-5"
          max="15"
          value={angle}
          onChange={(e) => setAngle(Number(e.target.value))}
        />
        <p>
          一片机翼，藏着很多好问题。<span>示意图 · 不代表计算结果</span>
        </p>
      </div>
    </div>
  );
}
