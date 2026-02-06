import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere, Stars, Sky, Float, Html, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

// 프로젝트 구조에 맞는 데이터 경로를 확인하세요.
import DATA from './data.json';

// [1] 피어나는 열매 및 동적 연결선 컴포넌트
function FactNode({ item, stalkX, activeColor, isSelected, toggleSelect, cardRefs }) {
  const meshRef = useRef();
  const bloomRef = useRef();
  const [lineStyle, setLineStyle] = useState({ width: 0, rotate: 0, visible: false });

  // 매 프레임 애니메이션 및 실선 좌표 계산
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    
    // 1. 열매 스케일 및 왜곡 애니메이션
    if (meshRef.current) {
      const targetScale = isSelected ? 1.6 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }

    // 2. 피어난 꽃(Bloom) 효과 회전
    if (isSelected && bloomRef.current) {
      bloomRef.current.rotation.z += 0.01;
      bloomRef.current.scale.setScalar(1.4 + Math.sin(t * 3) * 0.05);
    }

    // 3. 카드 중심과 열매를 잇는 실선 계산
    if (isSelected && cardRefs.current[`${stalkX}-${item.y}`]) {
      const cardEl = cardRefs.current[`${stalkX}-${item.y}`];
      const rect = cardEl.getBoundingClientRect();
      
      // 패널 영역 밖으로 나가면 선 숨기기
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        if (lineStyle.visible) setLineStyle(prev => ({ ...prev, visible: false }));
        return;
      }

      const cardY = rect.top + rect.height / 2;
      const cardX = rect.left;

      const vector = new THREE.Vector3(stalkX, item.y, 0).project(camera);
      const fruitX = (vector.x + 1) * window.innerWidth / 2;
      const fruitY = -(vector.y - 1) * window.innerHeight / 2;

      const dx = cardX - fruitX;
      const dy = cardY - fruitY;
      
      setLineStyle({
        width: Math.sqrt(dx * dx + dy * dy),
        rotate: Math.atan2(dy, dx),
        visible: true
      });
    }
  });

  return (
    <group position={[stalkX, item.y, 0]}>
      {/* 메인 열매 (클릭 시 하얗게 피어남) */}
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); toggleSelect(item.y, stalkX); }}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <MeshDistortMaterial 
          color={isSelected ? "#ffffff" : activeColor} 
          speed={isSelected ? 3 : 0} 
          distort={isSelected ? 0.3 : 0} 
          emissive={isSelected ? "#ffffff" : activeColor}
          emissiveIntensity={isSelected ? 2.5 : 0.4}
        />
      </mesh>

      {/* 꽃이 피어나는 시각적 효과 (링 레이어) */}
      {isSelected && (
        <group ref={bloomRef}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[Math.PI / 2.5 * i, Math.PI / 4 * i, 0]}>
              <torusGeometry args={[0.55, 0.01, 16, 100]} />
              <meshBasicMaterial color="white" transparent opacity={0.3} />
            </mesh>
          ))}
          <pointLight intensity={1.5} distance={3} color="white" />
        </group>
      )}

      {/* 동적 연결 실선 */}
      {isSelected && lineStyle.visible && (
        <Html zIndexRange={[0, 0]}>
          <div style={{
            position: 'absolute',
            width: `${lineStyle.width}px`,
            height: '1px',
            background: `linear-gradient(to right, white 0%, transparent 100%)`,
            opacity: 0.4,
            transformOrigin: 'left center',
            transform: `rotate(${lineStyle.rotate}rad)`,
            pointerEvents: 'none',
          }} />
        </Html>
      )}
    </group>
  )
}

// [2] 메인 앱 컴포넌트
export default function App() {
  const [selectedList, setSelectedList] = useState([]); 
  const [showTitle, setShowTitle] = useState(true);
  const [visibleStalks, setVisibleStalks] = useState({ lee: true, main: true, park: true });
  const orbitRef = useRef();
  const cardRefs = useRef({});

  // 줄기 간격 배치
  const STALK_X = { lee: -10, main: -6, park: -2 };

  const getStalkColor = (x) => {
    if (x === STALK_X.lee) return '#ffcc00';
    if (x === STALK_X.park) return '#00ffff';
    return '#ffffff';
  };

  const toggleSelect = (y, stalkX) => {
    const id = `${stalkX}-${y}`;
    setSelectedList(prev => {
      if (prev.find(item => item.id === id)) {
        return prev.filter(item => item.id !== id);
      } else {
        const ownerKey = Object.keys(STALK_X).find(key => STALK_X[key] === stalkX);
        const rawItem = DATA[ownerKey].find(d => d.y === y);
        const newItem = { id, y, stalkX, owner: ownerKey, color: getStalkColor(stalkX), ...rawItem };
        // 💡 최신순(y값 내림차순) 정렬
        return [...prev, newItem].sort((a, b) => b.y - a.y);
      }
    });
  };

  const toggleStalkVisibility = (key) => {
    setVisibleStalks(prev => {
      const newState = { ...prev, [key]: !prev[key] };
      if (!newState[key]) {
        setSelectedList(list => list.filter(item => {
          const ownerK = Object.keys(STALK_X).find(k => STALK_X[k] === item.stalkX);
          return ownerK !== key;
        }));
      }
      return newState;
    });
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: '#010103', position: 'relative', overflow: 'hidden', color: 'white' }}>
      
      {/* 🟢 좌상단 가변 제목 영역 */}
      {showTitle && (
        <div style={{ position: 'fixed', top: '30px', left: '40px', zIndex: 10, display: 'flex', gap: '40px', pointerEvents: 'none' }}>
          {Object.entries(STALK_X).map(([key, x]) => visibleStalks[key] && (
            <div key={key} style={{ borderLeft: `4px solid ${getStalkColor(x)}`, paddingLeft: '12px', transition: 'all 0.5s' }}>
              <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase' }}>{key}</div>
              <div style={{ fontWeight: '900', fontSize: '16px' }}>
                {key === 'lee' ? '이언주' : key === 'park' ? '박주민' : '핵심 이슈'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🔵 우측 대시보드 (통합 컨트롤 + 카드 피드) */}
      <div style={{
        position: 'absolute', right: 0, top: 0, width: '400px', height: '100%',
        background: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(40px)',
        zIndex: 900, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.1)'
      }}>
        
        {/* 컨트롤 패널 */}
        <div style={{ padding: '30px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '20px', letterSpacing: '2px', color: '#666' }}>STALKS MONITOR</div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button onClick={() => setShowTitle(!showTitle)} style={ctrlBtnStyle}>제목 토글</button>
            <button onClick={() => {setSelectedList([]); orbitRef.current.reset();}} style={ctrlBtnStyle}>전체 리셋</button>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', color: '#444', marginBottom: '10px', fontWeight: 'bold' }}>FILTERING</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {Object.keys(STALK_X).map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}>
                  <input type="checkbox" checked={visibleStalks[key]} onChange={() => toggleStalkVisibility(key)} style={{ accentColor: getStalkColor(STALK_X[key]) }} />
                  <span style={{ color: visibleStalks[key] ? 'white' : '#444' }}>{key === 'lee' ? '이언주' : key === 'park' ? '박주민' : '메인'}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 카드 피드 (스크롤) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {selectedList.length === 0 ? (
            <div style={{ opacity: 0.15, textAlign: 'center', marginTop: '100px', fontSize: '13px' }}>
              줄기를 활성화하고<br/>열매를 클릭하여 정보를 확인하세요.
            </div>
          ) : (
            selectedList.map((card) => (
              <div 
                key={card.id} 
                ref={el => cardRefs.current[card.id] = el}
                style={{ 
                  background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px',
                  borderLeft: `5px solid ${card.color}`, position: 'relative',
                  animation: 'slideIn 0.4s ease-out'
                }}
              >
                <button onClick={() => toggleSelect(card.y, card.stalkX)} style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '20px' }}>×</button>
                <div style={{ fontSize: '10px', color: card.color, fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase' }}>{card.owner}</div>
                <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '10px', lineHeight: '1.4' }}>{card.event}</div>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#999', lineHeight: '1.7' }}>{card.fact}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ⚪ 3D 캔버스 영역 */}
      <div style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1 }}>
        <Canvas camera={{ position: [-8, 8, 26], fov: 45 }}>
          <Sky sunPosition={[100, 20, 100]} turbidity={0.1} />
          <Stars radius={100} count={2000} factor={4} fade />
          <ambientLight intensity={0.6} />
          <pointLight position={[15, 15, 15]} intensity={1.5} />
          
          {Object.entries(STALK_X).map(([key, x]) => visibleStalks[key] && (
            <group key={key}>
              {/* 타임라인 줄기 */}
              <mesh position={[x, 0, -0.1]}>
                <cylinderGeometry args={[0.07, 0.07, 150, 16]} />
                <meshStandardMaterial color={getStalkColor(x)} transparent opacity={0.2} />
              </mesh>
              {/* 데이터 열매들 */}
              {DATA[key].map((item, i) => (
                <FactNode 
                  key={i} item={item} stalkX={x} activeColor={getStalkColor(x)} 
                  isSelected={selectedList.some(s => s.id === `${x}-${item.y}`)} 
                  toggleSelect={toggleSelect}
                  cardRefs={cardRefs}
                />
              ))}
            </group>
          ))}

          <OrbitControls 
            ref={orbitRef} 
            makeDefault 
            enablePan 
            screenSpacePanning
            maxDistance={60}
            minDistance={5}
          />
        </Canvas>
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  )
}

const ctrlBtnStyle = {
  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'white', padding: '12px 0', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
};