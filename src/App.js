import React, { useState, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls, Stars, Sky, Html } from '@react-three/drei'
import * as THREE from 'three'

import DATA from './data.json';

// [1] FactNode 컴포넌트 (훅 호출 순서 에러 방지 완료)
function FactNode({ item, stalkX, activeColor, isSelected, toggleSelect, cardRefs, showAllLabels, isVisibleByTime }) {
  const meshRef = useRef();
  const outlineRef = useRef();
  const [lineStyle, setLineStyle] = useState({ width: 0, rotate: 0, visible: false });

  useFrame(({ camera }) => {
    if (!isVisibleByTime) return; // 렌더링은 안되더라도 훅 계산은 안전하게 패스

    if (meshRef.current && outlineRef.current) {
      const targetScale = isSelected ? 1.8 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      const outlineScale = targetScale * 1.15;
      outlineRef.current.scale.lerp(new THREE.Vector3(outlineScale, outlineScale, outlineScale), 0.1);
    }
    if (isSelected && cardRefs.current[item.id]) {
      const cardEl = cardRefs.current[item.id];
      const rect = cardEl.getBoundingClientRect();
      const vector = new THREE.Vector3(stalkX, item.y, 0).project(camera);
      const fruitX = (vector.x + 1) * window.innerWidth / 2;
      const fruitY = -(vector.y - 1) * window.innerHeight / 2;
      const dx = rect.left - fruitX;
      const dy = (rect.top + rect.height / 2) - fruitY;
      setLineStyle({ width: Math.sqrt(dx * dx + dy * dy), rotate: Math.atan2(dy, dx), visible: true });
    }
  });

  if (!isVisibleByTime) return null;

  return (
    <group position={[stalkX, item.y, 0]}>
      <mesh ref={outlineRef}><sphereGeometry args={[0.35, 16, 16]} /><meshBasicMaterial color="#000000" side={THREE.BackSide} /></mesh>
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); toggleSelect(item.y, stalkX); }}>
        <sphereGeometry args={[0.35, 32, 32]} /><meshBasicMaterial color={isSelected ? "#ffffff" : activeColor} />
      </mesh>
      {(showAllLabels || isSelected) && (
        <Html distanceFactor={15} position={[0.6, 0.4, 0]}>
          <div style={{ background: isSelected ? 'white' : 'black', color: isSelected ? 'black' : 'white', border: `2px solid ${activeColor}`, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.6)', animation: 'fadeIn 0.2s' }}>
            <span style={{ color: activeColor, marginRight: '6px' }}>{item.date}</span>{item.event}
          </div>
        </Html>
      )}
      {isSelected && lineStyle.visible && (
        <Html zIndexRange={[0, 0]}><div style={{ position: 'absolute', width: `${lineStyle.width}px`, height: '2.5px', background: 'white', transformOrigin: 'left center', transform: `rotate(${lineStyle.rotate}rad)`, pointerEvents: 'none' }} /></Html>
      )}
    </group>
  );
}

// [2] 메인 앱
export default function App() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [visibleStalks, setVisibleStalks] = useState({ lee: true, main: true, park: true });
  
  // 💡 데이터에서 실제 Y값의 범위를 추출합니다.
  const dataBoundaries = useMemo(() => {
    const allY = Object.values(DATA).flat().map(d => d.y);
    return {
      min: Math.min(...allY) || 0,
      max: Math.max(...allY) || 100
    };
  }, []);

  // 💡 초기 범위를 데이터의 실제 범위로 설정
  const [timeRange, setTimeRange] = useState([dataBoundaries.min, dataBoundaries.max]);
  
  const cameraControlRef = useRef();
  const cardRefs = useRef({});

  const STALK_X = { lee: -10, main: -6, park: -2 };
  const getStalkColor = (x) => ({ '-10': '#ffcc00', '-6': '#ffffff', '-2': '#00ffff' }[x]);
  const STALK_NAME = { lee: '이언주', main: '핵심이슈', park: '박주민' };

  const filteredItems = useMemo(() => {
    let list = [];
    Object.entries(STALK_X).forEach(([key, x]) => {
      if (visibleStalks[key]) {
        DATA[key].forEach(item => {
          if (item.y >= timeRange[0] && item.y <= timeRange[1]) {
            list.push({ ...item, id: `${x}-${item.y}`, stalkX: x, color: getStalkColor(x) });
          }
        });
      }
    });
    return list.sort((a, b) => b.y - a.y);
  }, [visibleStalks, timeRange]);

  const toggleSelect = (y, stalkX) => {
    const id = `${stalkX}-${y}`;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleHome = () => {
    if (filteredItems.length === 0) return;
    const box = new THREE.Box3();
    filteredItems.forEach(t => box.expandByPoint(new THREE.Vector3(t.stalkX, t.y, 0)));
    cameraControlRef.current?.fitToBox(box, true, { paddingLeft: 4, paddingRight: 10, paddingTop: 4, paddingBottom: 4 });
  };

  const handleFocus = () => {
    const targets = filteredItems.filter(it => selectedIds.includes(it.id));
    if (targets.length === 0) return;
    const box = new THREE.Box3();
    targets.forEach(t => box.expandByPoint(new THREE.Vector3(t.stalkX, t.y, 0)));
    cameraControlRef.current?.fitToBox(box, true, { paddingLeft: 2, paddingRight: 8, paddingTop: 2, paddingBottom: 2 });
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: '#08080a', position: 'relative', overflow: 'hidden' }}>
      
      {/* 대시보드 */}
      <div style={{ position: 'absolute', right: 0, top: 0, width: '420px', height: '100%', background: 'rgba(10, 10, 15, 0.98)', borderLeft: '2px solid #222', zIndex: 900, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '30px 20px', borderBottom: '1px solid #222' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '25px' }}>
            <button onClick={handleHome} style={btnStyle}>🏠 HOME (ALL)</button>
            <button onClick={handleFocus} style={btnStyle}>🔍 FOCUS (SEL)</button>
            <button onClick={() => setShowAllLabels(!showAllLabels)} style={{...btnStyle, background: showAllLabels ? '#fff' : '#111', color: showAllLabels ? '#000' : '#fff'}}>🏷️ INDEX {showAllLabels ? 'OFF' : 'ON'}</button>
            <button onClick={() => setSelectedIds([])} style={btnStyle}>❌ RESET</button>
          </div>

          {/* 💡 데이터 범위에 연동된 슬라이더 */}
          <div style={{ marginBottom: '20px', background: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #333' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px', fontWeight: 'bold' }}>📅 TIMELINE RANGE (Y: {dataBoundaries.min} ~ {dataBoundaries.max})</div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="range" min={dataBoundaries.min} max={dataBoundaries.max} value={timeRange[0]} onChange={(e) => setTimeRange([parseFloat(e.target.value), timeRange[1]])} style={{ flex: 1 }} />
              <input type="range" min={dataBoundaries.min} max={dataBoundaries.max} value={timeRange[1]} onChange={(e) => setTimeRange([timeRange[0], parseFloat(e.target.value)])} style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#00ffff', marginTop: '8px' }}>
              <span>START: {timeRange[0].toFixed(1)}</span>
              <span>END: {timeRange[1].toFixed(1)}</span>
            </div>
          </div>

          <div style={{ background: '#050505', padding: '12px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {Object.keys(STALK_X).map(key => (
                <label key={key} style={{ fontSize: '11px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input type="checkbox" checked={visibleStalks[key]} onChange={() => setVisibleStalks(p => ({...p, [key]: !p[key]}))} /> {STALK_NAME[key]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredItems.map((item) => {
            const isActive = selectedIds.includes(item.id);
            if (!showAllLabels && !isActive) return null;
            return (
              <div key={item.id} ref={el => cardRefs.current[item.id] = el} onClick={() => toggleSelect(item.y, item.stalkX)} style={{ background: isActive ? '#151520' : '#0a0a0c', border: isActive ? `2px solid ${item.color}` : '1px solid #1a1a1a', borderLeft: `8px solid ${item.color}`, borderRadius: '10px', padding: isActive ? '20px' : '12px 15px', cursor: 'pointer' }}>
                <div style={{ fontSize: isActive ? '11px' : '12px', color: isActive ? item.color : '#eee', fontWeight: 'bold' }}>{item.date} {item.event}</div>
                {isActive && <div style={{ marginTop: '10px', fontSize: '13px', color: '#ccc', borderTop: '1px solid #333', paddingTop: '10px' }}>{item.fact}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1 }}>
        <Canvas camera={{ position: [-12, 12, 35], fov: 45 }}>
          <Sky sunPosition={[100, 20, 100]} />
          <Stars radius={120} count={1500} factor={4} />
          <ambientLight intensity={1.5} />
          {Object.entries(STALK_X).map(([key, x]) => visibleStalks[key] && (
            <group key={key}>
              <mesh position={[x, 0, -0.16]}><cylinderGeometry args={[0.09, 0.09, 300, 12]} /><meshBasicMaterial color="#000000" /></mesh>
              <mesh position={[x, 0, -0.1]}><cylinderGeometry args={[0.05, 0.05, 300, 12]} /><meshBasicMaterial color={getStalkColor(x)} /></mesh>
              {DATA[key].map((item, i) => (
                <FactNode 
                  key={`${key}-${i}`} 
                  item={{...item, id:`${x}-${item.y}`}} 
                  stalkX={x} 
                  activeColor={getStalkColor(x)} 
                  isSelected={selectedIds.includes(`${x}-${item.y}`)} 
                  toggleSelect={toggleSelect} 
                  cardRefs={cardRefs} 
                  showAllLabels={showAllLabels}
                  isVisibleByTime={item.y >= timeRange[0] && item.y <= timeRange[1]}
                />
              ))}
            </group>
          ))}
          <CameraControls ref={cameraControlRef} makeDefault minDistance={2} maxDistance={200} />
        </Canvas>
      </div>
    </div>
  );
}

const btnStyle = { background: '#111', border: '1px solid #333', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' };