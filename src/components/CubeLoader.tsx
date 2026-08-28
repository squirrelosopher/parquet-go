import { Box as CubeIcon } from 'lucide-react';

const CUBE_SIZES = [16, 24, 32, 24, 16];

export function CubeLoader() {
    return (
        <div className="cubes">
            {CUBE_SIZES.map((size, i) => (
                <CubeIcon key={i} className="cube" size={size} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
        </div>
    );
}
