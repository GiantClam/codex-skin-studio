import * as migration_20260718_084028 from './20260718_084028';
import * as migration_20260718_173534_paired_theme_pet_packages from './20260718_173534_paired_theme_pet_packages';
import * as migration_20260718_200000_skill_upload_nonces from './20260718_200000_skill_upload_nonces';
import * as migration_20260720_120000_download_grants from './20260720_120000_download_grants';

export const migrations = [
  {
    up: migration_20260718_084028.up,
    down: migration_20260718_084028.down,
    name: '20260718_084028',
  },
  {
    up: migration_20260718_173534_paired_theme_pet_packages.up,
    down: migration_20260718_173534_paired_theme_pet_packages.down,
    name: '20260718_173534_paired_theme_pet_packages',
  },
  {
    up: migration_20260718_200000_skill_upload_nonces.up,
    down: migration_20260718_200000_skill_upload_nonces.down,
    name: '20260718_200000_skill_upload_nonces'
  },
  {
    up: migration_20260720_120000_download_grants.up,
    down: migration_20260720_120000_download_grants.down,
    name: '20260720_120000_download_grants'
  },
];
