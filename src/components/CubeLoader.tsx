import { Box as CubeIcon } from 'lucide-react';

const CUBE_SIZES = [22, 34, 46, 34, 22];

export function CubeLoader() {
    return (
        <div className="cubes">
            {CUBE_SIZES.map((size, i) => (
                <CubeIcon key={i} className="cube" size={size} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
        </div>
    );
}
