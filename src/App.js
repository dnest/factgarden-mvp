import React, { useState, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls, Stars, Sky, Html } from '@react-three/drei'
import * as THREE from 'three'

import DATA from './data.json';

// [1] FactNode 컴포넌트 (기존 유지)
function FactNode({ item, stalkX, activeColor, isSelected, toggleSelect, cardRefs, showAllLabels }) {
  const meshRef = useRef();
  const outlineRef = useRef();
  const [lineStyle, setLineStyle] = useState({ width: 0, rotate: 0, visible: false });

  useFrame(({ camera }) => {
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
  const cameraControlRef = useRef();
  const cardRefs = useRef({});

  const STALK_X = { lee: -10, main: -6, park: -2 };
  const getStalkColor = (x) => ({ '-10': '#ffcc00', '-6': '#ffffff', '-2': '#00ffff' }[x]);
  const STALK_NAME = { lee: '이언주', main: '핵심이슈', park: '박주민' };

  const timelineItems = useMemo(() => {
    let list = [];
    Object.entries(STALK_X).forEach(([key, x]) => {
      if (visibleStalks[key]) {
        DATA[key].forEach(item => list.push({ ...item, id: `${x}-${item.y}`, stalkX: x, color: getStalkColor(x) }));
      }
    });
    return list.sort((a, b) => b.y - a.y);
  }, [visibleStalks]);

  const toggleSelect = (y, stalkX) => {
    const id = `${stalkX}-${y}`;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // 💡 개선된 handleFocus: 선택된 모든 열매가 보이도록 줌 조절
  const handleFocus = () => {
    if (selectedIds.length === 0 || !cameraControlRef.current) return;

    // 1. 선택된 열매들의 좌표 추출
    const targets = timelineItems.filter(it => selectedIds.includes(it.id));
    
    // 2. 바운딩 박스(영역) 계산
    const box = new THREE.Box3();
    targets.forEach(t => {
      box.expandByPoint(new THREE.Vector3(t.stalkX, t.y, 0));
    });

    // 3. 해당 영역이 다 보이도록 카메라 이동 (여백 포함)
    cameraControlRef.current.fitToBox(box, true, { paddingLeft: 2, paddingRight: 8, paddingTop: 2, paddingBottom: 2 });
  };

  const handleHome = () => cameraControlRef.current?.setLookAt(-6, 8, 35, -6, 5, 0, true);

  return (
    <div style={{ width: "100vw", height: "100vh", background: '#08080a', position: 'relative', overflow: 'hidden' }}>
      
      {/* UI 영역 */}
      <div style={{ position: 'fixed', top: '40px', left: '40px', zIndex: 10, display: 'flex', gap: '40px' }}>
        {Object.entries(STALK_X).map(([key, x]) => visibleStalks[key] && (
          <div key={key} style={{ borderLeft: `5px solid ${getStalkColor(x)}`, paddingLeft: '18px', color: 'white' }}>
            <div style={{ fontSize: '11px', opacity: 0.5 }}>{key.toUpperCase()}</div>
            <div style={{ fontWeight: '900', fontSize: '22px' }}>{STALK_NAME[key]}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', right: 0, top: 0, width: '420px', height: '100%', background: 'rgba(10, 10, 15, 0.98)', borderLeft: '2px solid #222', zIndex: 900, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '30px 20px', borderBottom: '1px solid #222' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
            <button onClick={handleHome} style={btnStyle}>🏠 HOME</button>
            <button onClick={handleFocus} style={btnStyle}>🔍 FOCUS</button>
            <button onClick={() => setShowAllLabels(!showAllLabels)} style={{...btnStyle, background: showAllLabels ? '#fff' : '#111', color: showAllLabels ? '#000' : '#fff'}}>🏷️ INDEX {showAllLabels ? 'OFF' : 'ON'}</button>
            <button onClick={() => setSelectedIds([])} style={btnStyle}>❌ RESET</button>
          </div>
          <div style={{ background: '#050505', padding: '15px', borderRadius: '10px' }}>
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
          {timelineItems.map((item) => {
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

      {/* 3D 영역 */}
      <div style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1 }}>
        <Canvas camera={{ position: [-12, 12, 35], fov: 45 }}>
          <Sky sunPosition={[100, 20, 100]} />
          <Stars radius={120} count={1500} factor={4} />
          <ambientLight intensity={1.5} />
          {Object.entries(STALK_X).map(([key, x]) => visibleStalks[key] && (
            <group key={key}>
              <mesh position={[x, 0, -0.16]}><cylinderGeometry args={[0.09, 0.09, 150, 12]} /><meshBasicMaterial color="#000000" /></mesh>
              <mesh position={[x, 0, -0.1]}><cylinderGeometry args={[0.05, 0.05, 150, 12]} /><meshBasicMaterial color={getStalkColor(x)} /></mesh>
              {DATA[key].map((item, i) => (
                <FactNode key={i} item={{...item, id:`${x}-${item.y}`}} stalkX={x} activeColor={getStalkColor(x)} isSelected={selectedIds.includes(`${x}-${item.y}`)} toggleSelect={toggleSelect} cardRefs={cardRefs} showAllLabels={showAllLabels} />
              ))}
            </group>
          ))}
          <CameraControls ref={cameraControlRef} makeDefault minDistance={2} maxDistance={100} />
        </Canvas>
      </div>
    </div>
  );
}

const btnStyle = { background: '#111', border: '1px solid #333', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' };