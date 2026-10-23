import { Loader2 } from 'lucide-react'
import { getGroupImageUrl } from '../../../lib/labourCategoryDisplay.js'
import allCategoryImg from '../../../assets/all-category.jpg'

const ALL_TILE_IMAGE = allCategoryImg

function CategoryTile({ label, imageSrc, active, onClick, onBrand }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lc-swiggy-cat-tile shrink-0 snap-start ${onBrand ? 'lc-swiggy-cat-tile--on-brand' : ''}`}
      data-active={active ? 'true' : 'false'}
    >
      <span className="lc-swiggy-cat-img">
        <img
          src={imageSrc}
          alt=""
          className="lc-img-reveal h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onLoad={(e) => e.currentTarget.classList.add('lc-img-loaded')}
        />
      </span>
      <span className="lc-swiggy-cat-tile-label lc-swiggy-cat-label">{label}</span>
    </button>
  )
}

/** Work-area filter — `onBrand` for header zone on green background. */
export function IndividualHomeCategoryRail({ groups, loading, selectedGroupId, onSelectGroup, onBrand = false }) {
  return (
    <div className={onBrand ? 'pb-4 pt-2' : 'pt-1'}>
      {!onBrand ? (
        <div className="lc-home-section-head mb-0">
          <h3>Work areas</h3>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden /> : null}
        </div>
      ) : null}

      {onBrand && loading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-white/90" aria-hidden />
        </div>
      ) : null}

      <div
        className={`-mx-1 flex snap-x snap-mandatory gap-5 sm:gap-6 overflow-x-auto pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden ${
          onBrand ? 'px-1 pt-3' : 'px-1 pt-4'
        }`}
      >
        <CategoryTile
          label="All"
          imageSrc={ALL_TILE_IMAGE}
          active={selectedGroupId == null}
          onClick={() => onSelectGroup(null)}
          onBrand={onBrand}
        />
        {groups.map((g) => (
          <CategoryTile
            key={String(g._id)}
            label={g.name}
            imageSrc={getGroupImageUrl(g)}
            active={selectedGroupId === String(g._id)}
            onClick={() => onSelectGroup(String(g._id))}
            onBrand={onBrand}
          />
        ))}
      </div>
    </div>
  )
}
