'use client'

import { DirectImageCropper } from '@/components/admin/direct-image-cropper'
import type { CropOutput, NormalizedCropRect } from '@/lib/media/image-crop'

type Props = {
  sourceFile: File | null
  initialCrop?: NormalizedCropRect | null
  onCancel: () => void
  onApply: (result: CropOutput) => void
}

export function EditorialCoverCropper({ sourceFile, initialCrop, onCancel, onApply }: Props) {
  return <DirectImageCropper
    sourceFile={sourceFile}
    initialCrop={initialCrop}
    aspectRatio={16 / 9}
    outputWidth={1600}
    outputHeight={900}
    title="Adjust cover crop"
    description="Drag the crop rectangle or its corner handles. The aspect ratio stays locked at 16:9."
    warnBelowOutput
    onCancel={onCancel}
    onApply={onApply}
  />
}
