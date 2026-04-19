# Gridwolf — Cloud Marketplace Submission Guide

This document covers the **publisher-side** process for listing Gridwolf on
the AWS Marketplace and Azure Marketplace. End-users deploying Gridwolf from
the marketplace listings don't need to read this — they just click **Launch**.

See also: [DEPLOYMENT.md](../DEPLOYMENT.md) for the full list of deployment
paths (Docker Compose, Helm, OVA, AWS, Azure).

---

## Azure Marketplace (Managed Application)

### Package layout

The Azure Marketplace "Azure Application" offer (Solution Template or
Managed Application variant) expects a ZIP containing:

```
deploy/azure/
├── mainTemplate.json       ← ARM, compiled from gridwolf.bicep
├── createUiDefinition.json ← Portal form (shipped in-repo)
├── viewDefinition.json     ← Post-deploy view (shipped in-repo)
└── gridwolf.bicep          ← Source of truth; ARM is generated from this
```

### Build the submission ZIP

```bash
# Requires: az CLI with bicep extension installed
az bicep build --file deploy/azure/gridwolf.bicep \
  --outfile deploy/azure/mainTemplate.json

cd deploy/azure
zip ../gridwolf-azure-app.zip \
  mainTemplate.json \
  createUiDefinition.json \
  viewDefinition.json
```

### Validate locally before upload

```bash
# Sanity-check the form renders (opens in Azure Portal sandbox)
az deployment group validate \
  --resource-group gridwolf-test-rg \
  --template-file deploy/azure/mainTemplate.json \
  --parameters adminPasswordOrKey='<ssh-pub-key>'

# Preview the UI
# Visit https://portal.azure.com/#blade/Microsoft_Azure_CreateUIDef/SandboxBlade
# and paste the contents of createUiDefinition.json.
```

### Partner Center submission

1. Create a **Commercial Marketplace** account at Partner Center.
2. Create a new **Azure Application** offer → Solution Template.
3. On the **Technical configuration** tab, upload `gridwolf-azure-app.zip`.
4. On the **Plan overview** tab:
   - Pricing model: Free (bring-your-own-licence — Gridwolf itself is AGPL)
   - Fulfilment: Solution Template (not Managed Application — keeps the VM
     in the customer's subscription with full control)
5. Submit for certification. Expect 3–5 business days for first review.

### Updating an existing listing

Bump `gridwolf.bicep`'s default `gridwolfVersion`, recompile, re-zip, and
upload a new plan version via Partner Center. Existing deployments are
unaffected — customers re-deploy at their own cadence.

---

## AWS Marketplace (CloudFormation-based AMI product)

### Options

AWS Marketplace supports three product types that fit Gridwolf:

| Type | When to pick it | Artifact |
|---|---|---|
| **AMI** | Simplest. One region at launch, expand to more later. | AMI ID per region |
| **AMI + CloudFormation** | Lets buyers launch via your CFN template. | AMI + `deploy/aws/gridwolf.template.yaml` |
| **Container** | If you ship Gridwolf as an ECS/EKS-native product. | Docker Hub / ECR image URI |

We recommend **AMI + CloudFormation**: it matches how most customers
already evaluate the product (self-launch from the CFN template in-repo)
and the Marketplace UX adds a one-click deploy button on top.

### Build a marketplace-grade AMI

Use the existing `packer/gridwolf.pkr.hcl` as a starting point; the
Marketplace scanner requires:

- No default passwords anywhere (Gridwolf already auto-generates secrets)
- No SSH host keys baked into the image (Packer's cleanup script handles this)
- cloud-init enabled and configured to re-generate host keys on first boot
- No Docker Hub credentials in image layers (we pull public images only)

```bash
# Build the Marketplace AMI (one per region you intend to launch in)
cd packer
packer init .
packer build -var "aws_region=us-east-1" \
             -var "gridwolf_version=1.1.0" \
             -only=amazon-ebs.ubuntu \
             gridwolf.pkr.hcl
```

Share the resulting AMI with the AWS Marketplace seller account
(`679593333241`) per the [self-service AMI scanning docs](https://docs.aws.amazon.com/marketplace/latest/userguide/ami-single-ami-products.html).

### CloudFormation adjustments for Marketplace

The in-repo `deploy/aws/gridwolf.template.yaml` is a **self-launch** template
(hardcodes Ubuntu AMIs and pulls from Docker Hub at boot). For Marketplace,
submit a variant that:

1. Replaces the `AmiMap` mapping with a single parameter:
   ```yaml
   AmiId:
     Type: AWS::EC2::Image::Id
     Description: Gridwolf AMI (auto-populated by Marketplace)
   ```
2. Removes the `docker pull` + `docker compose up` user-data section — the
   Marketplace AMI has Gridwolf baked in and a systemd unit that starts it
   on boot.
3. Keeps the same parameters for `InstanceType`, `KeyPairName`, `AllowedCidr`,
   and `DataVolumeSizeGB` so the UX matches.

Save that variant as `deploy/aws/gridwolf.marketplace.template.yaml` before
uploading to the seller portal.

### Submission checklist

- [ ] Product listing page draft with logo, tagline, long description
- [ ] Architecture diagram (we recommend one PNG + one editable `.drawio`)
- [ ] At least one screenshot of the Gridwolf dashboard
- [ ] Support email (`support@gridwolf.io`) and support SLA statement
- [ ] Fulfilment: CloudFormation
- [ ] Pricing: BYOL (Bring Your Own Licence) — Gridwolf core is AGPL-3.0
- [ ] Category: Security → Network Security
- [ ] Usage instructions (link to `DEPLOYMENT.md` in this repo)

Submit via the [AWS Marketplace Management Portal](https://aws.amazon.com/marketplace/management/).
First review typically takes 2–4 weeks.

---

## Docker Hub (Verified Publisher)

The `docker-hub.yml` workflow signs images with cosign keyless OIDC and
attaches SLSA provenance + CycloneDX SBOMs — enough to qualify for the
**Docker Verified Publisher** badge. Once we have 30+ days of signed pushes,
apply at <https://hub.docker.com/publishers/>.

---

## Post-submission maintenance

Every tagged release (`git tag v1.x.y && git push --tags`):

1. GitHub Actions pushes signed images to Docker Hub (`docker-hub.yml`)
2. OVA workflow builds and attaches the appliance to the GitHub release
   (`build-ova.yml`)
3. Manually bump the marketplace listings:
   - Azure: regenerate `mainTemplate.json`, upload new plan version
   - AWS: rebuild AMI with the new `gridwolf_version`, share with Marketplace,
     request a product update

This cadence is deliberate — marketplace certification adds 3–10 business
days of review, so listings track the stable channel rather than every tag.
