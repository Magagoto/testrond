using UnityEngine.Rendering.Universal;
using UnityEngine.Rendering;

public class BlitMaterialFeature : ScriptableRendererFeature
{
    private RTHandle tempTexture;

    public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
    {
        tempTexture = RTHandles.Alloc(Vector2.one, TextureXR.slices, dimension: TextureDimension.Tex2D, name: "_TemporaryColorTexture");
        // Ajoutez ici les passes de rendu nécessaires
    }

    public override void FrameCleanup(CommandBuffer cmd)
    {
        if (tempTexture != null)
        {
            RTHandles.Release(tempTexture);
            tempTexture = null;
        }
    }
}