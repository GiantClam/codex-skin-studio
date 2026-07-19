import * as migration_20260718_084028 from './20260718_084028';
import * as migration_20260718_173534_paired_theme_pet_packages from './20260718_173534_paired_theme_pet_packages';
import * as migration_20260718_200000_skill_upload_nonces from './20260718_200000_skill_upload_nonces';

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
];
