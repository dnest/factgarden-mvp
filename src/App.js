import React, { useState, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Sky, Html } from '@react-three/drei'
import * as THREE from 'three'

// 데이터 소스 (경로 확인 필수)
import DATA from './data.json';

// [1] 카툰 스타일 FactNode 컴포넌트
function FactNode({ item, stalkX, activeColor, isSelected, toggleSelect, cardRefs, showAllLabels }) {
  const meshRef = useRef();
  const outlineRef = useRef();
  const [lineStyle, setLineStyle] = useState({ width: 0, rotate: 0, visible: false });

  useFrame(({ camera }) => {
    // 1. 카툰 외곽선 & 열매 스케일 동기화 애니메이션
    if (meshRef.current && outlineRef.current) {
      const targetScale = isSelected ? 1.8 : 1;
      const lerpFactor = 0.1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);
      // 외곽선은 열매보다 항상 15% 더 크게 유지
      const outlineScale = targetScale * 1.15;
      outlineRef.current.scale.lerp(new THREE.Vector3(outlineScale, outlineScale, outlineScale), lerpFactor);
    }

    // 2. 동적 연결선 로직
    if (isSelected && cardRefs.current[item.id]) {
      const cardEl = cardRefs.current[item.id];
      const rect = cardEl.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        if (lineStyle.visible) setLineStyle(prev => ({ ...prev, visible: false }));
        return;
      }
      const vector = new THREE.Vector3(stalkX, item.y, 0).project(camera);
      const fruitX = (vector.x + 1) * window.innerWidth / 2;
      const fruitY = -(vector.y - 1) * window.innerHeight / 2;
      const dx = rect.left - fruitX;
      const dy = (rect.top + rect.height / 2) - fruitY;
      setLineStyle({ width: Math.sqrt(dx * dx + dy * dy), rotate: Math.atan2(dy, dx), visible: true });
    }
  });

  return (
    <group position={[stalkX, item.y, 0]}>
      {/* 💡 카툰 외곽선 (Black Outline) */}
      <mesh ref={outlineRef}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
      </mesh>
      
      {/* 💡 단색 열매 (Flat Toon Style) */}
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); toggleSelect(item.y, stalkX); }}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial color={isSelected ? "#ffffff" : activeColor} />
      </mesh>

      {/* 3D 라벨 표시 */}
      {(showAllLabels || isSelected) && (
        <Html distanceFactor={15} position={[0.6, 0.4, 0]}>
          <div style={{
            background: isSelected ? 'white' : 'black',
            color: isSelected ? 'black' : 'white',
            border: `2px solid ${isSelected ? activeColor : '#444'}`,
            padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
            whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            animation: 'fadeIn 0.2s'
          }}>
            <span style={{ color: activeColor, marginRight: '6px' }}>{item.date}</span>
            {item.event}
          </div>
        </Html>
      )}

      {/* 연결 실선 */}
      {isSelected && lineStyle.visible && (
        <Html zIndexRange={[0, 0]}>
          <div style={{
            position: 'absolute', width: `${lineStyle.width}px`, height: '2.5px',
            background: 'white', transformOrigin: 'left center',
            transform: `rotate(${lineStyle.rotate}rad)`, pointerEvents: 'none'
          }} />
        </Html>
      )}
    </group>
  )
}

// [2] 메인 앱 컴포넌트
export default function App() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [visibleStalks, setVisibleStalks] = useState({ lee: true, main: true, park: true });
  const [showTitle, setShowTitle] = useState(true);
  
  const orbitRef = useRef();
  const cardRefs = useRef({});

  const STALK_X = { lee: -10, main: -6, park: -2 };
  const STALK_NAME = { lee: '이언주', main: '핵심이슈', park: '박주민' };
  const getStalkColor = (x) => ({ '-10': '#ffcc00', '-6': '#ffffff', '-2': '#00ffff' }[x]);

  const timelineItems = useMemo(() => {
    let list = [];
    Object.entries(STALK_X).forEach(([key, x]) => {
      if (visibleStalks[key]) {
        DATA[key].forEach(item => list.push({ ...item, id: `${x}-${item.y}`, stalkX: x, color: getStalkColor(x), owner: key }));
      }
    });
    return list.sort((a, b) => b.y - a.y);
  }, [visibleStalks]);

  const toggleSelect = (y, stalkX) => {
    const id = `${stalkX}-${y}`;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // 홈 버튼: 초기 위치로
  const handleHome = () => orbitRef.current.setLookAt(-6, 8, 35, -6, 5, 0, true);
  
  // 맞춤 버튼: 마지막 선택 항목으로 줌인
  const handleFocus = () => {
    if (selectedIds.length === 0) return;
    const lastId = selectedIds[selectedIds.length - 1];
    const target = timelineItems.find(it => it.id === lastId);
    if (target) orbitRef.current.setLookAt(target.stalkX - 4, target.y + 1, 12, target.stalkX, target.y, 0, true);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: '#08080a', position: 'relative', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* 🟢 좌상단 제목 섹션 */}
      {showTitle && (
        <div style={{ position: 'fixed', top: '40px', left: '40px', zIndex: 10, display: 'flex', gap: '40px' }}>
          {Object.entries(STALK_X).map(([key, x]) => visibleStalks[key] && (
            <div key={key} style={{ borderLeft: `5px solid ${getStalkColor(x)}`, paddingLeft: '18px', color: 'white' }}>
              <div style={{ fontSize: '11px', opacity: 0.5, fontWeight: 'bold', textTransform: 'uppercase' }}>{key}</div>
              <div style={{ fontWeight: '900', fontSize: '22px', letterSpacing: '-0.5px' }}>{STALK_NAME[key]}</div>
            </div>
          ))}
        </div>
      )}

      {/* 🔵 우측 대시보드 */}
      <div style={{
        position: 'absolute', right: 0, top: 0, width: '420px', height: '100%',
        background: 'rgba(10, 10, 15, 0.98)', borderLeft: '2px solid #222', zIndex: 900, display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '30px 20px', borderBottom: '1px solid #222' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '15px', letterSpacing: '1px' }}>CONTROL SYSTEM</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
            <button onClick={handleHome} style={btnStyle}>🏠 HOME</button>
            <button onClick={handleFocus} style={btnStyle}>🔍 FOCUS</button>
            <button onClick={() => setShowAllLabels(!showAllLabels)} style={{...btnStyle, background: showAllLabels ? '#fff' : '#111', color: showAllLabels ? '#000' : '#fff'}}>
              🏷️ INDEX {showAllLabels ? 'OFF' : 'ON'}
            </button>
            <button onClick={() => setSelectedIds([])} style={btnStyle}>❌ RESET</button>
          </div>

          <div style={{ background: '#050505', padding: '15px', borderRadius: '10px', border: '1px solid #222' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {Object.keys(STALK_X).map(key => (
                <label key={key} style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: visibleStalks[key] ? 'white' : '#444' }}>
                  <input type="checkbox" checked={visibleStalks[key]} onChange={() => setVisibleStalks(p => ({...p, [key]: !p[key]}))} style={{ accentColor: getStalkColor(STALK_X[key]) }} />
                  {STALK_NAME[key]}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 💡 아코디언 스타일 인덱스 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {timelineItems.map((item) => {
            const isActive = selectedIds.includes(item.id);
            if (!showAllLabels && !isActive) return null;

            return (
              <div 
                key={item.id}
                ref={el => cardRefs.current[item.id] = el}
                onClick={() => toggleSelect(item.y, item.stalkX)}
                style={{
                  background: isActive ? '#151520' : '#0a0a0c',
                  border: isActive ? `2px solid ${item.color}` : '1px solid #1a1a1a',
                  borderLeft: `8px solid ${item.color}`,
                  borderRadius: '10px', padding: isActive ? '20px' : '12px 15px',
                  cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? `0 10px 30px ${item.color}15` : 'none'
                }}
              >
                <div style={{ fontSize: isActive ? '11px' : '12px', color: isActive ? item.color : '#eee', fontWeight: 'bold' }}>
                  <span style={{ opacity: 0.5, marginRight: '10px' }}>{item.date}</span>
                  {item.event}
                </div>
                {isActive && (
                  <div style={{ marginTop: '15px', animation: 'fadeIn 0.3s' }}>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#ccc', lineHeight: '1.7', borderTop: '1px solid #333', paddingTop: '12px' }}>
                      {item.fact}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ⚪ 3D 캔버스 영역 */}
      <div style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1 }}>
        <Canvas camera={{ position: [-12, 12, 35], fov: 45 }}>
          <Sky sunPosition={[100, 20, 100]} turbidity={0.1} />
          <Stars radius={120} count={1500} factor={4} />
          <ambientLight intensity={1.5} />
          
          {Object.entries(STALK_X).map(([key, x]) => visibleStalks[key] && (
            <group key={key}>
              {/* 줄기 외곽선 */}
              <mesh position={[x, 0, -0.16]}><cylinderGeometry args={[0.09, 0.09, 150, 12]} /><meshBasicMaterial color="#000000" /></mesh>
              {/* 메인 줄기 */}
              <mesh position={[x, 0, -0.1]}><cylinderGeometry args={[0.05, 0.05, 150, 12]} /><meshBasicMaterial color={getStalkColor(x)} /></mesh>
              
              {DATA[key].map((item, i) => (
                <FactNode 
                  key={i} 
                  item={{...item, id:`${x}-${item.y}`}} 
                  stalkX={x} 
                  activeColor={getStalkColor(x)} 
                  isSelected={selectedIds.includes(`${x}-${item.y}`)} 
                  toggleSelect={toggleSelect} 
                  cardRefs={cardRefs}
                  showAllLabels={showAllLabels}
                />
              ))}
            </group>
          ))}
          <OrbitControls ref={orbitRef} makeDefault minDistance={5} maxDistance={100} />
        </Canvas>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}

const btnStyle = { background: '#111', border: '1px solid #333', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' };